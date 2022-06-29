import plotly.express as px
import pandas as pd
from typing import Dict
from plotly.subplots import make_subplots

from .plotting import px_to_subplot, style_figure
from .params import params

def plot_indicator(dat, **kwargs):

    fig = px.line(
        dat,
        x="date",
        y="value",
        color="platform",
        markers=True
    )

    fig.update_traces(
        connectgaps=False,
        hovertemplate="<b>Date</b>: %{x}<br>"
        + "<b>"
        + kwargs["element"]
        + "</b>: %{y}",
    )

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
            title_text=params.sat_axis_mapper[list(plots.keys())[row - 1]], row=row, col=1
        )

    height = 500 if len(plots) == 1 else 250 * len(plots)
    sub.update_layout(height=height)

    dat = pd.concat(dfs, axis=0)
    x_ticks = [
        dat.date.min().date(),
        dat.date.max().date(),
    ]
    sub = style_figure(sub, x_ticks)
    sub.update_layout(
        margin={"r": 0, "t": 20, "l": 0, "b": 0},
    )

    return sub