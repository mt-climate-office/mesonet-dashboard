import pandas as pd
import io
import requests
import datetime as dt
from dateutil import relativedelta as rd
from typing import Optional, Union
from urllib import parse

import pandas as pd
from .params import params


def get_sites() -> pd.DataFrame:
    """Pulls station data from the Montana Mesonet V2 API and returns a dataframe.

    Returns:
        pd.DataFrame: DataFrame of Montana Mesonet stations.
    """
    dat = pd.read_csv(f"{params.API_URL}stations/?type=csv")
    dat["long_name"] = dat["name"] + " (" + dat["sub_network"] + ")"
    dat = dat.sort_values("long_name")
    dat = dat[dat['station'] != 'mcoopsbe']
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
    e = ",".join(params.elements)

    q = {
        "stations": station,
        "elements": e,
        "start_time": start_time,
        "level": 1,
        "type": "csv",
    }

    if end_time:
        if end_time == dt.date.today():
            end_time = dt.datetime.now()
        end_time = format_dt(end_time)
        q.update({"end_time": end_time})

    payload = parse.urlencode(q, safe=",:")

    r = requests.get(
        url=f"{params.API_URL}observations",
        params=payload,
    )


    with io.StringIO(r.text) as text_io:
        dat = pd.read_csv(text_io)

    return dat


def reindex_by_date(df, time_freq):
    dates = pd.date_range(df.index.min(), df.index.max(), freq=time_freq)
    out = df.reindex(dates)

    out = (
        out.drop(columns="datetime").reset_index().rename(columns={"index": "datetime"})
    )

    return out


def filter_top_of_hour(df):

    df.index = pd.DatetimeIndex(df.datetime)
    df = df[(df.index.minute == 0)] 
    df = df.reset_index(drop=True)
    return df


def clean_format(
    station: str,
    start_time: Optional[Union[dt.date, dt.datetime]] = params.START,
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

    time_freq = "5min" if station[:3] == "ace" else "15min"

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


    out = out.reset_index()
    out = out.rename(columns=params.lab_swap)

    out.index = pd.DatetimeIndex(out.datetime)
    out = reindex_by_date(out, time_freq)
    out = out.iloc[1:]

    return out


def get_station_latest(station):

    r = requests.get(
        url=f"{params.API_URL}latest",
        params={"stations": station, "type": "csv"},
    )

    with io.StringIO(r.text) as text_io:
        dat = pd.read_csv(text_io)
    dat = dat.loc[:, dat.columns.isin(["datetime"] + params.elem_labs)]
    dat = dat.rename(columns=params.lab_swap)
    dat = dat.rename(columns={"datetime": "Timestamp"})
    dat = dat.T.reset_index()
    dat.columns = ["value", "name"]
    dat = dat.dropna()

    return dat.to_dict("records")
