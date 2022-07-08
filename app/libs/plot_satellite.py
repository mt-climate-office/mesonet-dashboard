import datetime as dt
from typing import Dict

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from dateutil.relativedelta import relativedelta as rd
from plotly.subplots import make_subplots

from .params import params
from .plotting import px_to_subplot, style_figure


def plot_indicator(fig, dat, **kwargs):

    dat = dat.assign(
        date=str(dt.date.today().year)
        + "-"
        + dat.date.dt.month.astype(str)
        + "-"
        + dat.date.dt.day.astype(str)
    )
    dat = dat[dat.date.str.split("-").str[-2:].str.join("-") != "2-29"]
    dat = dat.assign(date=pd.to_datetime(dat.date))
    dat = dat.assign(grp=dat.year.astype(str) + "_" + dat.platform)
    cur_year = dt.date.today().year
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

    for trace in fig["data"]:
        if trace["name"] is None:
            trace["showlegend"] = False

    return fig


def plot_all(dfs: Dict[str, pd.DataFrame], **kwargs):

    fig = make_subplots(rows=len(dfs), cols=1)
    for idx, tup in enumerate(dfs.items(), start=1):
        v, df = tup
        fig = plot_indicator(fig, df, element=v, idx=idx)

    for row in range(1, len(dfs) + 1):
        fig.update_yaxes(
            title_text=params.sat_axis_mapper[list(dfs.keys())[row - 1]],
            row=row,
            col=1,
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


def lab_from_df(df):
    platform = list(set(df.platform.values))[0]
    element = list(set(df.element.values))[0]
    element = params.sat_axis_mapper[element]
    element = element.replace("<br>", " ")
    return f"{platform} {element}"


def plot_comparison(dat1, dat2):
    lab1 = lab_from_df(dat1)
    lab2 = lab_from_df(dat2)

    dat1 = dat1[["date", "value"]]
    dat2 = dat2[["date", "value"]]
    tol = pd.Timedelta("16 day")
    dat1.index = dat1.date
    dat2.index = dat2.date
    out = pd.merge_asof(
        left=dat1,
        right=dat2,
        right_index=True,
        left_index=True,
        direction="nearest",
        tolerance=tol,
    )

    fig = px.scatter(out, x="value_x", y="value_y")

    fig = style_figure(fig, None)
    fig.update_layout(
        margin={"r": 0, "t": 20, "l": 0, "b": 0},
        xaxis_title=lab1,
        yaxis_title=lab2,
        height=600,
    )
    fig.update_traces(
        hovertemplate="<b>" + lab1 + "</b>: %{x}<br><b><b>" + lab2 + "</b>: %{y}"
    )

    return fig
