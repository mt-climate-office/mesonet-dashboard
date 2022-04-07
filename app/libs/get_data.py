import pandas as pd
import io
import requests
import datetime as dt
from dateutil import relativedelta as rd
from typing import Optional, Union

import pandas as pd
import plotly.express as px

# example weather url https://mobile.weather.gov/index.php?lat=48.34&lon=-111.82
# MCO Logo

AGRIMET_VARS = [
    "air_temp_0244",
    "bp",
    "ppt",
    "rh",
    "wind_spd_0244",
    "wind_dir_0244",
    "sol_rad",
    "soil_temp_0010",
    "soil_temp_0020",
    "soil_temp_0050",
    "soil_temp_0091",
    "soil_vwc_0010",
    "soil_vwc_0020",
    "soil_vwc_0050",
    "soil_vwc_0091",
]

HYRDOMET_VARS = [
    "air_temp_0200",
    "bp",
    "ppt",
    "rh",
    "wind_spd_1000",
    "wind_dir_1000",
    "sol_rad",
    "soil_temp_0005",
    "soil_temp_0010",
    "soil_temp_0020",
    "soil_temp_0050",
    "soil_temp_0100",
    "soil_vwc_0005",
    "soil_vwc_0010",
    "soil_vwc_0020",
    "soil_vwc_0050",
    "soil_vwc_0100",
]


API_URL = "https://mesonet.climate.umt.edu/api/v2/"


def switch(val: str) -> str:
    """Returns a readable name given a station element key.

    Args:
        val (str): An element from the APIv2 elements endpoint.

    Returns:
        str: A readable name for a given element.
    """
    mapper = {
        "bp": "Atmospheric Pressure",
        "soil_vwc_0005": "Soil Moisture at 2 in",
        "soil_vwc_0010": "Soil Moisture at 4 in",
        "soil_vwc_0020": "Soil Moisture at 8 in",
        "soil_vwc_0050": "Soil Moisture at 16 in",
        "soil_vwc_0091": "Soil Moisture at 36 in",
        "soil_vwc_0100": "Soil Moisture at 40 in",
        "soil_temp_0005": "Soil Temperature at 2 in",
        "soil_temp_0010": "Soil Temperature at 4 in",
        "soil_temp_0020": "Soil Temperature at 8 in",
        "soil_temp_0050": "Soil Temperature at 16 in",
        "soil_temp_0091": "Soil Temperature at 36 in",
        "soil_temp_0100": "Soil Temperature at 40 in",
        "air_temp_0200": "Air Temperature",
        "air_temp_0244": "Air Temperature",
        "rh": "Relatve Humidity",
        "ppt": "Daily Precipitation Total",
        "sol_rad": "Solar Radiation",
        "wind_spd_0244": "Wind Speed",
        "wind_spd_1000": "Wind Speed",
        "wind_dir_0244": "Wind Direction",
        "wind_dir_1000": "Wind Direction",
    }

    return mapper[val]


def get_sites() -> pd.DataFrame:
    """Pulls station data from the Montana Mesonet V2 API and returns a dataframe.

    Returns:
        pd.DataFrame: DataFrame of Montana Mesonet stations.
    """
    dat = pd.read_csv(f"{API_URL}stations/?type=csv")
    dat["long_name"] = dat["name"] + " (" + dat["sub_network"] + ")"
    dat = dat.sort_values("long_name")
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
) -> pd.DataFrame:
    """Given a Mesonet station name and date range, return a dataframe of climate data.

    Args:
        station (str): Montana Mesonet station short name.
        start_time (Union[dt.date, dt.datetime]): Start date of when records will begin.
        end_time (Union[dt.date, dt.datetime]): Date when records will stop.

    Returns:
        pd.DataFrame: DataFrame of records from 'station' ranging from 'start_date' to 'end_date'
    """
    start_time = format_dt(start_time)

    e = ",".join(HYRDOMET_VARS) if station[:3] == "ace" else ",".join(AGRIMET_VARS)

    params = {
        "stations": station,
        "elements": e,
        "start_time": start_time,
        "level": 1,
        "type": "csv",
        "wide": False,
    }

    if end_time:
        if end_time == dt.date.today():
            end_time = dt.datetime.now()
        end_time = format_dt(end_time)
        params.update({"end_time": end_time})

    r = requests.get(
        url=f"{API_URL}observations",
        params=params,
    )

    with io.StringIO(r.text) as text_io:
        dat = pd.read_csv(text_io)

    return dat


def clean_format(
    station: str,
    hourly: Optional[bool] = True,
    start_time: Optional[Union[dt.date, dt.datetime]] = dt.datetime.now()
    - rd.relativedelta(weeks=2),
    end_time: Optional[Union[dt.date, dt.datetime]] = None,
) -> pd.DataFrame:
    """Aggregate and reformat data from a mesonet station.

    Args:
        station (str): Montana Mesonet station short name.
        hourly (Optional[bool], optional): Whether or not to use top of the hour data (faster) or sub-hourly data (slower). Defaults to True.
        start_time (Optional[Union[dt.date, dt.datetime]], optional): Start date of when records will begin. Defaults to two weeks before current date.
        end_time (Optional[Union[dt.date, dt.datetime]], optional): Date when records will stop. Defaults to None.

    Returns:
        pd.DataFrame: DataFrame of station records in a cleaned format and with precip aggregated to daily sum.
    """
    dat = get_station_record(station, start_time, end_time)
    dat.datetime = pd.to_datetime(dat.datetime, utc=True)
    dat.datetime = dat.datetime.dt.tz_convert("America/Denver")
    dat = dat.set_index("datetime")
    dat["elem_lab"] = dat["element"].apply(switch)
    ppt = dat[dat.element == "ppt"]
    ppt.index = pd.DatetimeIndex(ppt.index)
    ppt = ppt.groupby(ppt.index.date)["value"].agg("sum").reset_index()
    ppt = ppt.rename(columns={"index": "datetime"})
    ppt["station"] = station
    ppt["element"] = "ppt_sum"
    ppt["units"] = "in"
    ppt["elem_lab"] = "Daily Precipitation Total"

    if hourly:
        dat = dat[(dat.index.minute == 0)]
    dat = dat.reset_index()

    out = pd.concat([dat, ppt], ignore_index=True)

    return out
