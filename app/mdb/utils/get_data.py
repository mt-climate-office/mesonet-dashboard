import httpx
import polars as pl

from mdb.utils.params import Params

API_URL = "https://mesonet.climate.umt.edu/api/elements?type=csv&public=False"


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


def get_stations() -> pl.DataFrame:
    r = httpx.get(f"{Params.API_URL}stations", params={"type": "csv"})
    df = pl.read_csv(r.content)
    return df.sort("name")


def get_observations(station, start_date, end_date, period) -> pl.DataFrame:
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

    r = httpx.get(f"{Params.API_URL}{endpoint}", params={
        "type": "csv",
        "stations": station,
        "start_time": start_date,
        "end_time": end_date,
        "premade": True,
        "rm_na": True,
        "public": False
    })
    df = pl.read_csv(r.content)
    if period == "monthly":
        # Extract year and month from the date column (assuming it's named 'date')
        ...
        # df = df.with_columns([
        #     pl.col("date").str.strptime(pl.Date, "%Y-%m-%d").alias("date_parsed"),
        # ])
        # df = df.with_columns([
        #     pl.col("date_parsed").dt.year().alias("year"),
        #     pl.col("date_parsed").dt.month().alias("month"),
        # ])
        # # Identify columns to aggregate
        # ppt_cols = [col for col in df.columns if "ppt" in col.lower()]
        # other_cols = [col for col in df.columns if col not in ppt_cols + ["date", "date_parsed", "year", "month"]]
        # # Build aggregation expressions
        # aggs = [pl.col(col).sum().alias(col) for col in ppt_cols]
        # aggs += [pl.col(col).mean().alias(col) for col in other_cols]
        # df = df.groupby(["year", "month"]).agg(aggs)
    return df
