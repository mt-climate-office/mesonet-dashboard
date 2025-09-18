"""
Data Retrieval Module for Montana Mesonet Dashboard

This module provides functions for retrieving and processing data from various sources
including the Montana Mesonet API, satellite databases, and weather services.
It handles data formatting, cleaning, and aggregation for use in the dashboard.

Key Functions:
- get_sites(): Retrieve station metadata
- get_station_record(): Get time series data for a station
- get_satellite_data(): Retrieve satellite-derived indicators
- get_derived(): Get derived agricultural metrics
"""

import datetime as dt
import io
import os
from typing import Any, Dict, List, Optional, Union
from urllib import parse
from urllib.error import HTTPError

import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv
from mt_mesonet_satellite import MesonetSatelliteDB
from natsort import natsorted
from requests import Request

from mdb.utils.params import params
from mdb.utils.plotting import deg_to_compass

load_dotenv()


def get_sites() -> pd.DataFrame:
    """
    Retrieve station metadata from the Montana Mesonet V2 API.

    Fetches comprehensive station information including location, network affiliation,
    and installation dates. Excludes the 'mcoopsbe' station and adds formatted
    long names for display purposes.

    Returns:
        pd.DataFrame: DataFrame containing station metadata with columns:
            - station: Station short name/ID
            - name: Station display name
            - sub_network: Network affiliation (HydroMet/AgriMet)
            - longitude/latitude: Geographic coordinates
            - elevation: Station elevation in meters
            - date_installed: Installation date
            - long_name: Formatted name with network info
    """
    dat = pd.read_csv(f"{params.API_URL}stations?type=csv")
    dat["long_name"] = dat["name"] + " (" + dat["sub_network"] + ")"
    dat = dat.sort_values("long_name")
    dat = dat[dat["station"] != "mcoopsbe"]
    return dat


def format_dt(d: Union[dt.date, dt.datetime]) -> str:
    """Reformat a date(time) to string in YYYYMMDD(THHMMSS) format.

    Args:
        d (Union[dt.date, dt.datetime]): Date or datetime object to convert.

    Returns:
        str: Reformatted date(time) string
    """
    if isinstance(d, dt.datetime):
        return d.strftime("%Y-%m-%dT%H:%M:%S")
    return d.strftime("%Y-%m-%d")


def get_station_record(
    station: str,
    start_time: Union[dt.date, dt.datetime],
    end_time: Union[dt.date, dt.datetime],
    period: Optional[str] = "hourly",
    e: Optional[str] = None,
    has_etr: Optional[bool] = True,
    na_info: Optional[bool] = False,
    public: Optional[bool] = True,
    rmna: Optional[bool] = True,
    derived_elems: Optional[List[str]] = None,
) -> pd.DataFrame:
    """
    Retrieve time series data for a Montana Mesonet station.

    Fetches meteorological observations from the Montana Mesonet API for a specified
    station and time period. Supports different temporal aggregations and can include
    derived variables like reference evapotranspiration.

    Args:
        station (str): Montana Mesonet station short name/ID.
        start_time (Union[dt.date, dt.datetime]): Start date/time for data retrieval.
        end_time (Union[dt.date, dt.datetime]): End date/time for data retrieval.
        period (Optional[str]): Temporal aggregation ('hourly', 'daily', 'monthly', 'raw').
            Defaults to 'hourly'.
        e (Optional[str]): Comma-separated list of elements to retrieve. If None,
            uses default elements from params.
        has_etr (Optional[bool]): Whether to include reference evapotranspiration.
            Defaults to True.
        na_info (Optional[bool]): Whether to include information about missing values.
            Defaults to False.
        public (Optional[bool]): Whether to use only public data. Defaults to True.
        rmna (Optional[bool]): Whether to remove missing values. Defaults to True.
        derived_elems (Optional[List[str]]): List of derived elements to include.

    Returns:
        pd.DataFrame: Time series data with columns for datetime, station, and
            requested meteorological variables. For monthly data, includes additional
            aggregation processing.

    Raises:
        HTTPError: If the API request fails and no alternative data sources are available.
    """
    start_time = format_dt(start_time)
    e = e or ",".join(params.elements)

    q = {
        "stations": station,
        "elements": e,
        "start_time": start_time,
        "level": 1,
        "type": "csv",
        "rm_na": rmna,
        "premade": True,
        "na_info": na_info,
        "public": public,
    }

    if end_time:
        if end_time == dt.date.today():
            end_time = dt.datetime.now()
        end_time = format_dt(end_time)
        q.update({"end_time": end_time})

    endpoint = params.endpoints[period]
    payload = parse.urlencode(q, safe=",:")

    r = Request("GET", url=f"{params.API_URL}{endpoint}", params=payload).prepare()

    try:
        dat = pd.read_csv(r.url)
    except HTTPError:
        if has_etr or derived_elems:
            dat = pd.DataFrame()
        else:
            raise HTTPError(r.url, 404, "No data found.", None, None)

    if has_etr:
        q["elements"] = "etr"
        endpoint = params.derived_endpoints[period]
        payload = parse.urlencode(q, safe=",:")

        r = Request("GET", url=f"{params.API_URL}{endpoint}", params=payload).prepare()

        etr = pd.read_csv(r.url)
        if not dat.empty:
            dat = dat.merge(etr, how="left", on=["station", "datetime"])
        else:
            dat = etr

    if derived_elems:
        q["elements"] = ",".join(derived_elems)
        endpoint = params.derived_endpoints[period]
        payload = parse.urlencode(q, safe=",:")

        r = Request("GET", url=f"{params.API_URL}{endpoint}", params=payload).prepare()

        derived = pd.read_csv(r.url)
        if not dat.empty:
            dat = dat.merge(derived, how="left", on=["station", "datetime"])
            if ("has_na_x" in dat.columns) and ("has_na_y" in dat.columns):
                dat = dat.assign(has_na=dat["has_na_x"] | dat["has_na_y"])
                dat = dat.drop(
                    columns=["has_na_x", "has_na_y"],
                )
        else:
            dat = derived

    if period == "monthly":
        dat = dat.assign(
            datetime=pd.to_datetime(dat["datetime"], utc=True).dt.tz_convert(
                "America/Denver"
            )
        )
        dat["month"] = dat["datetime"].dt.month
        dat["year"] = dat["datetime"].dt.year

        cols = {k: v for k, v in params.agg_funcs.items() if k in dat.columns}
        cols.update({"has_na": any})

        out = dat.groupby(["year", "month"]).agg(cols).reset_index()
        out["datetime"] = pd.to_datetime(out[["year", "month"]].assign(day=1))
        out = out.drop(columns=["year", "month"])
        return out

    return dat


def clean_format(dat: pd.DataFrame) -> pd.DataFrame:
    """
    Clean and format meteorological data from a Mesonet station.

    Processes raw station data by converting datetime columns to the appropriate
    timezone, and applying standardized column name mappings for consistent
    display throughout the dashboard.

    Args:
        dat (pd.DataFrame): Raw station data with datetime and meteorological columns.

    Returns:
        pd.DataFrame: Cleaned DataFrame with:
            - datetime column converted to America/Denver timezone
            - Column names standardized using params.lab_swap mapping
            - Data ready for plotting and analysis
    """

    dat.datetime = pd.to_datetime(dat.datetime, utc=True)
    dat.datetime = dat.datetime.dt.tz_convert("America/Denver")

    dat = dat.rename(columns=params.lab_swap)

    return dat


def get_station_latest(station: str) -> List[Dict[str, Any]]:
    """
    Retrieve the latest observations from a Montana Mesonet station.

    Fetches the most recent data point for a station and formats it for display
    in the dashboard's current conditions table. Includes calculated fields
    like wind chill/heat index and formatted wind direction.

    Args:
        station (str): Montana Mesonet station short name/ID.

    Returns:
        List[Dict[str, Any]]: List of dictionaries with 'value' and 'name' keys
            representing the latest observations. Includes:
            - All available meteorological variables
            - Calculated "Real Feel" temperature (wind chill/heat index)
            - Formatted wind direction with compass bearing
            - Timestamp of observations
    """
    r = requests.get(
        url=f"{params.API_URL}latest", params={"stations": station, "type": "csv"}
    )

    with io.StringIO(r.text) as text_io:
        dat = pd.read_csv(text_io)
    dat = dat.loc[:, dat.columns.isin(["datetime"] + params.elem_labs)]
    dat = dat.rename(columns=params.lab_swap)
    wind_col = [x for x in dat.columns if "Wind Speed" in x][0]

    try:
        dat["Real Feel [°F]"] = round(
            35.74
            + (0.6215 * dat["Air Temperature [°F]"])
            - (35.75 * (dat[wind_col] ** 0.16))
            + (0.4275 * dat["Air Temperature [°F]"] * (dat[wind_col] ** 0.16)),
            2,
        )
    except ValueError:
        pass

    try:
        dat["Wind Direction [deg]"] = (
            f"{deg_to_compass(dat['Wind Direction [deg]'])} ({dat['Wind Direction [deg]'].values[0]} deg)"
        )
    except ValueError:
        pass
    dat = dat.rename(columns={"datetime": "Timestamp"})
    dat = dat.T.reset_index()
    dat.columns = ["value", "name"]
    dat = dat.dropna()

    return dat.to_dict("records")


def get_ppt_summary(station: str) -> List[Dict[str, Any]]:
    """
    Retrieve precipitation summary statistics for a station.

    Fetches aggregated precipitation data including various time period totals
    (e.g., last 24 hours, 7 days, month, year) from the Montana Mesonet API.

    Args:
        station (str): Montana Mesonet station short name/ID.

    Returns:
        List[Dict[str, Any]]: List of dictionaries with 'name' and 'value' keys
            representing precipitation totals for different time periods.
            Returns empty dict if no data is available.
    """
    r = requests.get(
        url=f"{params.API_URL}derived/ppt/?stations={station}", params={"type": "csv"}
    )

    if not r.ok:
        return {}

    with io.StringIO(r.text) as text_io:
        dat = pd.read_csv(text_io)
    dat = pd.melt(dat, id_vars=["station"], var_name="time", value_name="value")
    dat = dat[["time", "value"]]
    dat = dat.rename(columns={"time": "name"})
    return dat.to_dict("records")


def get_satellite_data(
    station: str,
    element: str,
    start_time: Union[int, dt.date],
    end_time: Union[int, dt.date],
    platform: Optional[str] = None,
    modify_dates: Optional[bool] = True,
) -> pd.DataFrame:
    """
    Retrieve satellite-derived data for a Mesonet station location.

    Queries the Neo4j satellite database to extract time series of satellite
    indicators (e.g., NDVI, GPP, ET) at station locations. Handles data
    cleaning, unit conversions, and optional date modifications for plotting.

    Args:
        station (str): Montana Mesonet station short name/ID.
        element (str): Satellite indicator to retrieve (e.g., 'NDVI', 'GPP', 'ET').
        start_time (Union[int, dt.date]): Query start time as date object or
            Unix timestamp (seconds since 1970-01-01).
        end_time (Union[int, dt.date]): Query end time as date object or
            Unix timestamp (seconds since 1970-01-01).
        platform (Optional[str]): Satellite platform to filter by (e.g., 'MOD13A1.061').
            If None, returns data from all available platforms.
        modify_dates (Optional[bool]): Whether to normalize all dates to the current
            year for multi-year comparison plots. Defaults to True.

    Returns:
        pd.DataFrame: Satellite data with columns:
            - date: Observation date (potentially modified to current year)
            - value: Indicator value (with unit conversions applied)
            - platform: Satellite platform/product name
            - element: Indicator name
            - units: Original units
            - year: Original observation year

    Note:
        - Requires Neo4j database credentials in environment variables
        - Applies unit conversions for soil moisture (multiply by 100)
        - Filters out February 29th when modifying dates to current year
        - Replaces -9999 fill values with NaN
    """
    conn = MesonetSatelliteDB(
        user=os.getenv("Neo4jUser"),
        password=os.getenv("Neo4jPassword"),
        uri=os.getenv("Neo4jURI"),
    )

    if isinstance(start_time, dt.date):
        start_time = (start_time - dt.date(1970, 1, 1)).total_seconds()
    if isinstance(end_time, dt.date):
        end_time = (end_time - dt.date(1970, 1, 1)).total_seconds()

    dat = conn.query(
        station=station, element=element, start_time=start_time, end_time=end_time
    )
    dat = dat.assign(value=np.where(dat.value == -9999, np.nan, dat.value))
    conn.close()

    dat = dat.assign(date=pd.to_datetime(dat.date, unit="s"))
    dat = dat.sort_values(by=["platform", "date"])
    dat = dat.assign(platform=dat.platform.replace(params.satellite_product_map))
    dat = dat.assign(
        value=np.where(dat.units.str.contains("_sm_"), dat.value * 100, dat.value)
    )
    dat = dat.assign(value=np.where(dat.units == "Percent", dat.value * 100, dat.value))
    dat.reset_index(drop=True, inplace=True)
    dat = dat.assign(year=dat.date.dt.year)

    if modify_dates:
        dat = dat.assign(
            date=str(dt.date.today().year)
            + "-"
            + dat.date.dt.month.astype(str)
            + "-"
            + dat.date.dt.day.astype(str)
        )
        dat = dat[dat.date.str.split("-").str[-2:].str.join("-") != "2-29"]
        dat = dat.assign(date=pd.to_datetime(dat.date))

    if platform:
        dat = dat[dat["platform"] == params.satellite_product_map[platform]]
        dat.reset_index(drop=True, inplace=True)
    return dat


def summarise_station_to_daily(dat: pd.DataFrame, colname: str) -> pd.DataFrame:
    """
    Aggregate sub-daily station data to daily averages.

    Converts high-frequency station observations to daily means, handling
    timezone conversion and grouping by station and date.

    Args:
        dat (pd.DataFrame): Station data with datetime column and target variable.
        colname (str): Name of the column to aggregate to daily means.

    Returns:
        pd.DataFrame: Daily aggregated data with columns:
            - station: Station identifier
            - date: Date of observation
            - [colname]: Daily mean of the specified variable
    """
    dat.datetime = pd.to_datetime(dat.datetime, utc=True)
    dat.datetime = dat.datetime.dt.tz_convert("America/Denver")
    dat = dat.assign(date=dat.datetime.dt.date)
    dat = dat.groupby(["station", "date"]).agg({colname: "mean", "date": "min"})
    dat = dat.reset_index(drop=True)
    return dat


def get_sat_compare_data(
    station: str,
    sat_element: str,
    station_element: str,
    start_time: Union[int, dt.date],
    end_time: Union[int, dt.date],
    platform: str,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Retrieve paired satellite and station data for comparison analysis.

    Fetches both satellite-derived indicators and corresponding ground-based
    measurements for the same time period and location, enabling validation
    and comparison studies.

    Args:
        station (str): Montana Mesonet station short name/ID.
        sat_element (str): Satellite indicator element to retrieve.
        station_element (str): Corresponding ground-based measurement element.
        start_time (Union[int, dt.date]): Query start time.
        end_time (Union[int, dt.date]): Query end time.
        platform (str): Satellite platform identifier.

    Returns:
        tuple[pd.DataFrame, pd.DataFrame]: Tuple containing:
            - station_data: Daily aggregated ground measurements
            - sat_data: Satellite observations for the same dates

    Note:
        Station data is automatically aggregated to daily means to match
        the typical temporal resolution of satellite products.
    """
    sat_data = get_satellite_data(
        station, sat_element, start_time, end_time, platform, False
    )

    # if platform in ["SPL4CMDL.006", "SPL4SMGP.006"]:
    #     # Take every 8th observation from SMAP data. The API query takes too long
    #     # if using all the daily data.
    #     sat_data = sat_data.iloc[::8, :]

    dates = ",".join(set(sat_data.date.astype(str).values.tolist()))

    url = f"{params.API_URL}observations/daily/?stations={station}&elements={station_element}&dates={dates}&type=csv&wide=True&rm_na=True&premade=True"
    station_data = pd.read_csv(url)
    colname = station_data.columns[-1]
    station_data = summarise_station_to_daily(station_data, colname)

    return station_data, sat_data


def get_station_elements(station: str, public: bool = False) -> List[Dict[str, str]]:
    """
    Retrieve available data elements for a specific station.

    Fetches the list of meteorological variables available at a station,
    with standardized descriptions and natural sorting for display in
    dropdown menus and selection interfaces.

    Args:
        station (str): Montana Mesonet station short name/ID.
        public (bool): Whether to include only public elements (True) or
            all elements including internal/QC data (False). Defaults to False.

    Returns:
        List[Dict[str, str]]: List of dictionaries with 'value' and 'label' keys:
            - value: Element code/identifier for API queries
            - label: Human-readable description with standardized units

    Note:
        - Applies distance unit conversions (cm to inches, m to feet)
        - Uses natural sorting to order elements logically
        - Excludes elements not available at the specified station
    """
    station_elements = pd.read_csv(
        f"{params.API_URL}elements/{station}/?type=csv&public={not public}"
    )
    station_elements = station_elements.assign(
        description_short=station_elements["description_short"].replace(
            params.dist_swap, regex=True
        )
    )[["element", "description_short"]]
    station_elements.columns = ["value", "label"]
    station_elements = station_elements.sort_values("label")
    station_elements = station_elements.to_dict(orient="records")
    station_elements = natsorted(station_elements, key=lambda x: x["label"])
    return station_elements


def get_station_config(station: str) -> pd.DataFrame:
    """
    Retrieve instrument configuration and deployment history for a station.

    Fetches detailed information about sensors and instruments deployed at
    a station, including installation dates and measured elements. Used
    for annotating plots with sensor change events.

    Args:
        station (str): Montana Mesonet station short name/ID.

    Returns:
        pd.DataFrame: Configuration data with columns:
            - date_start: Instrument deployment date
            - date_end: Instrument removal date (if applicable)
            - elements: List of elements measured by the instrument
            - height: Measurement height/depth

        Returns empty DataFrame if no configuration data is available.

    Note:
        - Explodes the elements list so each element gets its own row
        - Excludes detailed instrument metadata (serial numbers, models)
        - Used primarily for plotting sensor change annotations
    """
    r = requests.get(
        url=f"{params.API_URL}config/{station}",
        params={"public": False},
    )

    instruments = r.json().get("instruments", [])

    if not instruments:
        return pd.DataFrame()

    dat = (
        pd.DataFrame(instruments)
        .explode("elements")
        .drop(columns=["serial_number", "type", "manufacturer", "model"])
    )
    return dat


def get_derived(
    station: str,
    variable: str,
    start: str,
    end: str,
    time: str,
    crop: Optional[str] = None,
) -> pd.DataFrame:
    """
    Retrieve derived agricultural and environmental metrics for a station.

    Fetches calculated variables like growing degree days, reference ET,
    soil water potential, and livestock comfort indices from the Montana
    Mesonet derived data endpoints.

    Args:
        station (str): Montana Mesonet station short name/ID.
        variable (str): Derived variable to retrieve (e.g., 'gdd', 'etr', 'swp').
        start (str): Start date in YYYY-MM-DD format.
        end (str): End date in YYYY-MM-DD format.
        time (str): Temporal aggregation ('daily', 'hourly').
        crop (Optional[str]): Crop type for GDD calculations (e.g., 'wheat', 'corn').
            Only used for growing degree day calculations.

    Returns:
        pd.DataFrame: Derived data with standardized column names applied.
            Columns vary by variable type but typically include:
            - datetime: Observation timestamp
            - station: Station identifier
            - [variable-specific columns]: Calculated values and metadata

    Note:
        - Soil variables use the observations endpoint instead of derived
        - GDD calculations require crop type specification
        - Column names are standardized using params.lab_swap mapping
        - Uses premade aggregations for faster response times
    """
    endpoint = "observations/" if "soil" in variable else "derived/"
    endpoint = f"{endpoint}{time}"

    q = {
        "stations": station,
        "start_time": start,
        "end_time": end,
        # "low": low,
        # "high": high,
        "alpha": 0.23,
        "elements": variable,
        "type": "csv",
        "premade": True,
        "rm_na": True,
        "keep": True,
    }
    if crop is not None:
        q.update({"crop": crop})

    payload = parse.urlencode(q, safe=",:")
    r = Request("GET", url=f"{params.API_URL}{endpoint}", params=payload).prepare()
    dat = pd.read_csv(r.url)
    dat = dat.rename(columns=params.lab_swap)
    return dat


def get_nws_forecast(lat: float, lon: float) -> None:
    """
    Retrieve National Weather Service forecast data for a location.

    Placeholder function for future implementation of NWS forecast
    integration. Would fetch weather forecasts for station locations
    to complement historical observations.

    Args:
        lat (float): Latitude coordinate.
        lon (float): Longitude coordinate.

    Returns:
        None: Function not yet implemented.

    Note:
        This function is reserved for future development of forecast
        capabilities in the dashboard.
    """
    pass
