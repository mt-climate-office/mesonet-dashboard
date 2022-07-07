import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
from typing import Dict
from plotly.subplots import make_subplots
import datetime as dt
from dateutil.relativedelta import relativedelta as rd

from .plotting import px_to_subplot, style_figure
from .params import params


def plot_indicator(dat, **kwargs):

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
    fig = go.Figure()
    for grp in dat.grp.drop_duplicates():
        year, platform = grp.split("_")
        year = int(year)
        color = params.sat_color_mapper[platform] if year == cur_year else "lightgrey"
        width = 2 if year == cur_year else 0.5
        hover = "<b>Date</b>: %{x}<br>" + "<b>" + kwargs["element"] + "</b>: %{y}"

        hover = {"hovertemplate": hover} if year == cur_year else {"hoverinfo": "none"}
        filt = dat[dat.grp == grp]
        fig.add_scatter(
            x=filt.date,
            y=filt.value,
            mode="lines",
            line=dict(color=color, width=width),
            name=platform if year == cur_year else None,
            **hover,
        )

    for trace in fig["data"]:
        if trace["name"] is None:
            trace["showlegend"] = False

    fig.update_layout(
        hovermode="x unified",
    )

    return fig


def plot_all(dfs: Dict[str, pd.DataFrame], **kwargs):

    plots = {}
    for v, df in dfs.items():
        plt = plot_indicator(df, element=v)
        plots[v] = plt

    sub = px_to_subplot(*list(plots.values()), shared_xaxes=False)

    for row in range(1, len(plots) + 1):
        sub.update_yaxes(
            title_text=params.sat_axis_mapper[list(plots.keys())[row - 1]],
            row=row,
            col=1,
        )

    height = 500 if len(plots) == 1 else 250 * len(plots)
    sub.update_layout(height=height)

    dat = pd.concat(dfs, axis=0)
    x_ticks = [
        dt.date(dt.date.today().year, 1, 1) - rd(days=1),
        dt.date(dt.date.today().year, 12, 31) + rd(days=1),
    ]
    sub = style_figure(sub, x_ticks)
    sub.update_layout(
        margin={"r": 0, "t": 20, "l": 0, "b": 0},
    )

    return sub


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
