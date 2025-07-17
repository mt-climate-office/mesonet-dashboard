import re
from typing import Any

import httpx
import polars as pl

from mdb.utils.params import Params

API_URL = "https://mesonet.climate.umt.edu/api/"


def get_elements() -> pl.DataFrame:
    r = httpx.get(
        f"{Params.API_URL}elements", params={"type": "csv", "public": "False"}
    )
    not_public = pl.read_csv(r.content)

    r = httpx.get(f"{Params.API_URL}elements", params={"type": "csv", "public": "True"})
    public = pl.read_csv(r.content)

    return pl.concat(
        [
            not_public.join(public, on=not_public.columns, how="anti").with_columns(
                pl.lit(False).alias("public")
            ),
            public.with_columns(pl.lit(True).alias("public")),
        ]
    )


def get_station_elements(station: str) -> pl.DataFrame:
    r = httpx.get(
        f"{Params.API_URL}elements/{station}",
        params={"type": "csv", "public": "False"},
    )

    return pl.read_csv(r.content)


def group_elements_df(df: pl.DataFrame, public: bool=True) -> pl.DataFrame:
    try:
        df = df.select("element", "description_short", "public")
        if public:
            df = df.filter(
                pl.col("public") == public
            )
    except pl.exceptions.ColumnNotFoundError:
        df = df.select("element", "description_short")
    
    return df.with_columns(
        [
            pl.col("element").str.replace(r"(_\d+)$", ""),  # Remove trailing _XXXX
            pl.col("description_short")
            .str.split("@")
            .list.get(0)
            .str.strip_suffix(" "),
        ]
    ).unique(subset=["element", "description_short"]).sort("description_short")



def get_stations() -> pl.DataFrame:
    r = httpx.get(f"{Params.API_URL}stations", params={"type": "csv"})
    df = pl.read_csv(r.content)
    return df.sort("name")


depth_mappings = {
    "@ -100 cm": "@ -40 in",
    "@ -91 cm": "@ -36 in",
    "@ -76 cm": "@ -30 in",
    "@ -70 cm": "@ -28 in",
    "@ -50 cm": "@ -20 in",
    "@ -20 cm": "@ -8 in",
    "@ -10 cm": "@ -4 in",
    "@ -5 cm": "@ -2 in",
    "@ 70 cm": "@ -28 in",
    "@ 76 cm": "@ -30 in",
}


def column_remapper(col_name: str) -> str:
    if "@" not in col_name:
        return col_name
    if "Wind" in col_name or "Gust" in col_name or "Air" in col_name:
        return re.sub(r" @.*(?=\[)", " ", col_name)
    for key in depth_mappings.keys():
        if key in col_name:
            return col_name.replace(key, depth_mappings[key])
    return col_name


def get_observations(station, start_date, end_date, period, rm_na=True) -> pl.DataFrame:
    match period:
        case "raw":
            endpoint = "observations"
        case "hourly":
            endpoint = "observations/hourly"
        case "daily":
            endpoint = "observations/daily"
        case "monthly":
            endpoint = "observations/daily"
        case _:
            raise ValueError(f"Invalid period: {period}")

    r = httpx.get(
        f"{Params.API_URL}{endpoint}",
        params={
            "type": "csv",
            "stations": station,
            "start_time": start_date,
            "end_time": end_date,
            "premade": True,
            "rm_na": rm_na,
            "public": False,
        },
    )
    df = pl.read_csv(r.content)
    df = df.rename(lambda x: column_remapper(x))
    return df


def get_latest(station: str) -> pl.DataFrame:
    r = httpx.get(
        f"{Params.API_URL}latest",
        params={
            "type": "csv",
            "stations": station,
        },
    )
    df = pl.read_csv(r.content)
    df = df.rename(lambda x: column_remapper(x))
    df = df.rename({"datetime": "Reading Timestamp"}).drop("station")
    df = df.unpivot(variable_name="Variable", value_name="Value")
    return df


def get_forecast_data(lat: float, lon: float) -> list[dict[str, Any]] | str:
    r = httpx.get(f"https://api.weather.gov/points/{lat},{lon}")
    if r.status_code == 200:
        try:
            fcast_url = r.json()["properties"]["forecast"]
        except KeyError:
            return "Forecast not available for this station."

        r2 = httpx.get(fcast_url)

        if r2.status_code == 200:
            try:
                return r2.json()["properties"]
            except KeyError:
                return "Forecast not available for this station."
    return "Forecast not available for this station."


def get_photo_config():
    r = httpx.get(f"{API_URL}photos?type=csv")

    if r.status_code == 200:
        df = pl.read_csv(r.content)
        df = df.with_columns(
            pl.col("Photo Directions")
            .map_elements(
                lambda x: re.findall(r"'(\w+)", x) if isinstance(x, str) else [],
                return_dtype=pl.List(pl.Utf8),
            )
            .alias("Photo Directions"),
            pl.col("Photo Start Date").str.strptime(pl.Date, "%Y-%m-%d", strict=False),
        )

        return df
    return pl.DataFrame()
