import datetime as dt
import io
import os
from typing import Optional, Union
from urllib import parse
from urllib.error import HTTPError

import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv
from mt_mesonet_satellite import MesonetSatelliteDB
from requests import Request

from mdb.utils.params import params
from mdb.utils.plotting import deg_to_compass

load_dotenv()


def get_sites() -> pd.DataFrame:
    """Pulls station data from the Montana Mesonet V2 API and returns a dataframe.

    Returns:
        pd.DataFrame: DataFrame of Montana Mesonet stations.
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
    derived_elems: Optional[list[str]] = None,
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
    """Aggregate and reformat data from a mesonet station.

    Args:
        station (str): Montana Mesonet station short name.
        hourly (Optional[bool], optional): Whether or not to use top of the hour data (faster) or sub-hourly data (slower). Defaults to True.
        start_time (Optional[Union[dt.date, dt.datetime]], optional): Start date of when records will begin. Defaults to two weeks before current date.
        end_time (Optional[Union[dt.date, dt.datetime]], optional): Date when records will stop. Defaults to None.

    Returns:
        pd.DataFrame: DataFrame of station records in a cleaned format and with precip aggregated to daily sum.
    """

    dat.datetime = pd.to_datetime(dat.datetime, utc=True)
    dat.datetime = dat.datetime.dt.tz_convert("America/Denver")

    dat = dat.rename(columns=params.lab_swap)

    return dat


def get_station_latest(station):
    r = requests.get(
        url=f"{params.API_URL}latest", params={"stations": station, "type": "csv"}
    )

    with io.StringIO(r.text) as text_io:
        dat = pd.read_csv(text_io)
    dat = dat.loc[:, dat.columns.isin(["datetime"] + params.elem_labs)]
    dat = dat.rename(columns=params.lab_swap)

    try:
        dat["Real Feel [°F]"] = round(
            35.74
            + (0.6215 * dat["Air Temperature [°F]"])
            - (35.75 * (dat["Wind Speed [mi/hr]"] ** 0.16))
            + (
                0.4275
                * dat["Air Temperature [°F]"]
                * (dat["Wind Speed [mi/hr]"] ** 0.16)
            ),
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


def get_ppt_summary(station):
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
    """Gather satellite data at a Mesonet station from the Neo4j database.

    Args:
        station (str): The name of the station to query.
        element (str): The satellite indicator element to query.
        start_time (Union[int, dt.date]): The time to begin the query. Can either be a datetime.date object or an int representing seconds since 1970-01-01.
        end_time (Union[int, dt.date]): The time to end the query. Can either be a datetime.date object or an int representing seconds since 1970-01-01.
        platform (Optional[str]): The name of a satellite platform to filter the results by.
        modify_dates (Optional[bool]): Whether to set all dates to the current year (for plotting purposes).

    Returns:
        pd.DataFrame: Pandas dataframe with data generated from the query.
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


def summarise_station_to_daily(dat, colname):
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
):
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


def get_station_elements(station, public=False):
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
    return station_elements


def get_derived(station, variable, start, end, time, crop=None):
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


def get_nws_forecast(lat: float, lon: float):
    pass
