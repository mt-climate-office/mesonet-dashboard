import datetime as dt
from typing import Dict

import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from dateutil.relativedelta import relativedelta as rd
from plotly.subplots import make_subplots

from .params import params
from .plotting import px_to_subplot, style_figure, add_boxplot_normals


def make_satellite_normals(df):
    df = df.assign(month=df.date.dt.month)
    df = df.assign(day=df.date.dt.day)
    cur_year = dt.date.today().year
    cur = df[df.year == cur_year]
    cur = cur[["platform", "element", "month", "day"]]

    df = (
        df.groupby_agg(
            by=["month", "day"],
            new_column_name="avg",
            agg_column_name="value",
            agg=np.median,
        )
        .groupby_agg(
            by=["month", "day"],
            new_column_name="mn",
            agg_column_name="value",
            agg=lambda x: np.quantile(x, 0.05),
        )
        .groupby_agg(
            by=["month", "day"],
            new_column_name="mx",
            agg_column_name="value",
            agg=lambda x: np.quantile(x, 0.95),
        )
        .assign(
            datetime=pd.to_datetime(
                str(cur_year) + "-" + df.month.astype(str) + "-" + df.day.astype(str)
            )
        )
        .select_columns("datetime", "mn", "mx")
        .drop_duplicates()
        .sort_values("datetime")
        .reset_index(drop=True)
    )

    df = df.assign(mn=df.mn.rolling(5, min_periods=1).mean())
    df = df.assign(mx=df.mx.rolling(5, min_periods=1).mean())

    return df


def plot_indicator(fig, dat, **kwargs):

    if kwargs["climatology"]:
        norms = make_satellite_normals(dat)

    dat = dat.assign(grp=dat.year.astype(str) + "_" + dat.platform)
    cur_year = dt.date.today().year
    dat = dat[dat.year == cur_year]
    element = params.sat_axis_mapper[kwargs["element"]].replace("<br>", " ")
    for grp in dat.grp.drop_duplicates():
        year, platform = grp.split("_")
        year = int(year)
        color = params.sat_color_mapper[platform] if year == cur_year else "lightgrey"
        width = 2 if year == cur_year else 0.5
        hover = "<br><b>Date</b>: %{x}<br>" + "<b>" + element + "</b>: %{y}"

        hover = {"hovertemplate": hover} if year == cur_year else {"hoverinfo": "none"}
        filt = dat[dat.grp == grp]
        fig.add_trace(
            go.Scatter(
                x=filt.date,
                y=filt.value,
                mode="lines",
                line=dict(color=color, width=width),
                name=platform if year == cur_year else None,
                legendgroup=str(kwargs["idx"]),
                legendgrouptitle_text="Product",
                **hover,
            ),
            row=kwargs["idx"],
            col=1,
        )
    if kwargs["climatology"]:

        mn_line = go.Scatter(
            x=norms.datetime,
            y=norms.mn,
            mode="lines",
            line={"dash": "dash", "color": "black"},
            showlegend=False,
            name="5th Percentile",
        )

        mx_line = go.Scatter(
            x=norms.datetime,
            y=norms.mx,
            mode="lines",
            line={"dash": "dash", "color": "black"},
            showlegend=False,
            name="95th Percentile",
            fill="tonexty",
            fillcolor="rgba(107,107,107,0.4)",
        )

        fig.add_trace(mn_line, row=kwargs["idx"], col=1)
        fig.add_trace(mx_line, row=kwargs["idx"], col=1)

    for trace in fig["data"]:
        if trace["name"] is None:
            trace["showlegend"] = False

    return fig


def plot_all(dfs: Dict[str, pd.DataFrame], climatology, **kwargs):

    fig = make_subplots(rows=len(dfs), cols=1)
    for idx, tup in enumerate(dfs.items(), start=1):
        v, df = tup
        fig = plot_indicator(fig, df, element=v, idx=idx, climatology=climatology)

    for row in range(1, len(dfs) + 1):
        fig.update_yaxes(
            title_text=params.sat_axis_mapper[list(dfs.keys())[row - 1]], row=row, col=1
        )

    height = 500 if len(dfs) == 1 else 250 * len(dfs)
    fig.update_layout(height=height)

    x_ticks = [
        dt.date(dt.date.today().year, 1, 1) - rd(days=1),
        dt.date(dt.date.today().year, 12, 31) + rd(days=1),
    ]
    fig = style_figure(fig, x_ticks, legend=True)
    fig.update_layout(
        margin={"r": 0, "t": 20, "l": 0, "b": 0},
        hovermode="x unified",
        legend_tracegroupgap=200,
    )

    return fig


def lab_from_df(df, station):
    element = list(set(df.element.values))[0]
    element = element if station else params.sat_axis_mapper[element]
    element = element.replace("<br>", " ")
    return element


def plot_comparison(dat1, dat2, station=None, flip=False):

    lab1 = lab_from_df(dat1, None)
    lab2 = lab_from_df(dat2, station)

    dat1 = dat1[["date", "value"]]
    dat2 = dat2[["date", "value"]]

    dat1.index = pd.DatetimeIndex(dat1.date)
    dat2.index = pd.DatetimeIndex(dat2.date)
    out = pd.merge_asof(
        left=dat1,
        right=dat2,
        right_index=True,
        left_index=True,
        direction="nearest",
        tolerance=pd.Timedelta("16 day"),
    )

    fig = px.scatter(
        out,
        x="value_y" if flip else "value_x",
        y="value_x" if flip else "value_y",
        custom_data=["date_x"],
    )

    fig = style_figure(fig, None)
    fig.update_layout(
        margin={"r": 0, "t": 20, "l": 0, "b": 0},
        xaxis_title=lab2 if flip else lab1,
        yaxis_title=lab1 if flip else lab2,
        height=600,
    )
    fig.update_traces(
        hovertemplate="<b>"
        + lab1
        + "</b>: %{x}<br><b>"
        + lab2
        + "</b>: %{y}<br><b>Date</b>: %{customdata[0]}"
    )

    return fig
