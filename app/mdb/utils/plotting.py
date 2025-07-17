import datetime as dt
from typing import Literal

import plotly.express as px
import polars as pl

from mdb.utils.params import Params


def style_figure(fig):
    fig.update_layout({"plot_bgcolor": "rgba(0, 0, 0, 0)"})
    fig.update_xaxes(showgrid=True, gridcolor="grey")
    fig.update_yaxes(showgrid=True, gridcolor="grey")
    fig.update_layout(showlegend=False)
    fig.update_layout(
        margin=dict(l=10, r=10, t=10, b=10),
    )
    return fig


def create_plot(df: pl.DataFrame, ylab: str):
    df = df.unpivot(index=["datetime"])
    fig = px.line(df, x="datetime", y="value", color="variable")
    fig.update_layout(xaxis_title=None, yaxis_title=ylab)
    fig = style_figure(fig)
    return fig


# credit to: https://stackoverflow.com/questions/7490660/converting-wind-direction-in-angles-to-text-words
def deg_to_compass(num):
    val = int((num / 22.5) + 0.5)
    arr = Params.wind_directions
    return arr[(val % 16)]


def plot_wind(wind_data):
    # Drop null values
    wind_data = wind_data.drop_nulls()

    # Convert wind direction to compass direction
    wind_data = wind_data.with_columns(
        pl.col("Wind Direction [deg]").map_elements(
            deg_to_compass, return_dtype=pl.String
        )
    )

    # Round wind speed
    wind_data = wind_data.with_columns(pl.col("Wind Speed [mi/h]").round(0))
    # Create a list of 8 whole numbers between 0 and the max wind speed
    max_speed = int(wind_data["Wind Speed [mi/h]"].max())
    speed_bins = [
        round(x)
        for x in pl.Series(range(8)).map_elements(
            lambda i: int(i * max_speed / 7), return_dtype=pl.Int16
        )
    ]
    # Create quantile cuts for wind speed
    wind_data = wind_data.with_columns(
        pl.col("Wind Speed [mi/h]").cut(speed_bins).alias("Wind Speed [mi/h]")
    )

    # Group by wind direction and speed, count frequency
    out = (
        wind_data.group_by(["Wind Direction [deg]", "Wind Speed [mi/h]"])
        .len()
        .rename({"len": "Frequency"})
    )

    # Get unique wind directions and find missing ones
    unq_wind = set(out["Wind Direction [deg]"].to_list())
    missing_dirs = [x for x in Params.wind_directions if x not in unq_wind]

    # Get unique wind speeds
    speeds = set(out["Wind Speed [mi/h]"].to_list())

    # Create rows for missing directions
    if missing_dirs and speeds:
        rows_data = [
            {"Wind Direction [deg]": x, "Wind Speed [mi/h]": y, "Frequency": 0}
            for x in missing_dirs
            for y in speeds
        ]
        rows = pl.DataFrame(rows_data).cast(
            {"Wind Speed [mi/h]": pl.Categorical, "Frequency": pl.UInt32}
        )
        out = pl.concat([out, rows])

    # Convert wind direction to categorical and sort
    out = out.with_columns(pl.col("Wind Direction [deg]").cast(pl.Categorical))

    out = out.sort(["Wind Direction [deg]", "Wind Speed [mi/h]"])

    # Rename column
    out = out.rename({"Wind Direction [deg]": "Wind Direction"})

    # Create polar bar chart
    fig = px.bar_polar(
        out.to_pandas(),  # Convert to pandas for plotly
        r="Frequency",
        theta="Wind Direction",
        color="Wind Speed [mi/h]",
        template="plotly_white",
        color_discrete_sequence=px.colors.sequential.Plasma_r,
    )

    return fig
