import pandas as pd
import io
import requests
import datetime as dt
from dateutil import relativedelta as rd
from typing import Optional, Union
from urllib import parse

import pandas as pd
from .globals import globals


def get_sites() -> pd.DataFrame:
    """Pulls station data from the Montana Mesonet V2 API and returns a dataframe.

    Returns:
        pd.DataFrame: DataFrame of Montana Mesonet stations.
    """
    dat = pd.read_csv(f"{globals.API_URL}stations/?type=csv")
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
    e = ",".join(globals.elements)

    params = {
        "stations": station,
        "elements": e,
        "start_time": start_time,
        "level": 1,
        "type": "csv",
    }

    payload = parse.urlencode(params, safe=",:")

    if end_time:
        if end_time == dt.date.today():
            end_time = dt.datetime.now()
        end_time = format_dt(end_time)
        params.update({"end_time": end_time})

    r = requests.get(
        url=f"{globals.API_URL}observations",
        params=payload,
    )

    with io.StringIO(r.text) as text_io:
        dat = pd.read_csv(text_io)

    return dat


def clean_format(
    station: str,
    hourly: Optional[bool] = True,
    start_time: Optional[Union[dt.date, dt.datetime]] = globals.START,
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

    ppt = dat[["Precipitation [in]"]]
    dat = dat.drop(columns="Precipitation [in]")
    ppt.index = pd.DatetimeIndex(ppt.index)
    ppt = pd.DataFrame(ppt.groupby(ppt.index.date)["Precipitation [in]"].agg("sum"))
    ppt.index = pd.DatetimeIndex(ppt.index)
    ppt.index = ppt.index.tz_localize("America/Denver")
    out = pd.concat([dat, ppt], axis=1)

    out = out[(out.index.minute == 0)] if hourly else out
    out = out.reset_index()
    out = out.rename(columns=globals.lab_swap)

    return out


def get_station_latest(station):

    r = requests.get(
        url=f"{globals.API_URL}latest",
        params={"stations": station, "type": "csv"},
    )

    with io.StringIO(r.text) as text_io:
        dat = pd.read_csv(text_io)
    dat = dat.loc[:, dat.columns.isin(["datetime"] + globals.elem_labs)]
    dat = dat.rename(columns=globals.lab_swap)
    dat = dat.rename(columns={"datetime": "Timestamp"})

    return dat.T.reset_index().to_dict("records")
