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

    dat = dat.assign(date = str(dt.date.today().year) + '-' + dat.date.dt.month.astype(str) + '-' + dat.date.dt.day.astype(str))
    dat = dat[dat.date.str.split("-").str[-2:].str.join("-") != "2-29"]
    dat = dat.assign(date = pd.to_datetime(dat.date))
    dat = dat.assign(grp = dat.year.astype(str) + "_" + dat.platform)
    cur_year = dt.date.today().year
    fig = go.Figure()
    for grp in dat.grp.drop_duplicates():
        year, platform = grp.split('_')
        year = int(year)
        color = params.sat_color_mapper[platform] if year == cur_year else 'lightgrey'
        width = 2 if year == cur_year else 0.5
        hover = ("<b>Date</b>: %{x}<br>"
        + "<b>"
        + kwargs["element"]
        + "</b>: %{y}")

        hover = {'hovertemplate': hover} if year == cur_year else {'hoverinfo': 'none'}
        filt = dat[dat.grp == grp]
        fig.add_scatter(
            x=filt.date, y=filt.value, mode="lines", 
            line=dict(
                color=color, width=width
            ),
            name=platform if year == cur_year else None,
            **hover
        )
    
    for trace in fig['data']: 
        if(trace['name'] is None): trace['showlegend'] = False

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
        dat.date.max().date() + rd(days=1),
    ]
    sub = style_figure(sub, x_ticks)
    sub.update_layout(
        margin={"r": 0, "t": 20, "l": 0, "b": 0},
    )

    return sub
