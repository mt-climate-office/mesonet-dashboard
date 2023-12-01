import plotly.graph_objects as go
from dateutil.relativedelta import relativedelta as rd
from plotly.subplots import make_subplots

from mdb.utils.plotting import style_figure


def add_etr_trace(fig, dat, idx):
    fig.add_trace(
        go.Bar(
            x=dat["datetime"],
            y=dat["Reference ET (a=0.23) [in]"],
            marker=dict(color="red"),
            name="ETr",
            hovertemplate="<b>Date</b>: %{x}<br>" + "<b>Reference ET Total</b>: %{y}",
        ),
        row=idx,
        col=1,
    )
    return fig


def add_gdd_trace(fig, dat, idx):
    fig.add_trace(
        go.Scatter(
            x=dat["datetime"],
            y=dat["Cumulative GDDs [GDD °F]"],
            mode="lines+markers",
            line=dict(color="orange", width=2),
            name="GDDs",
            hovertemplate="<b>Date</b>: %{x}<br>"
            + "<b>Cumulative Degree Days</b>: %{y}",
        ),
        row=idx,
        col=1,
    )
    return fig


def add_feels_like_trace(fig, dat, idx):
    fig.add_trace(
        go.Scatter(
            x=dat["datetime"],
            y=dat["Feels Like Temperature [°F]"],
            mode="lines+markers",
            line=dict(color="blue", width=2),
            name="Feels Like Temperature",
            hovertemplate="<b>Date</b>: %{x}<br>"
            + "<b>Feels Like Temperature</b>: %{y}",
        ),
        row=idx,
        col=1,
    )
    return fig


_match_case = {
    "etr": add_etr_trace,
    "gdd": add_gdd_trace,
    "feels_like": add_feels_like_trace,
}

_axis_labeller = {
    "etr": "<b>Reference ET<br>(a=0.23) [in]</b>",
    "gdd": "<b>Cumulative GDDs<br>[GDD °F]</b>",
    "feels_like": "<b>Feels Like Temperature<br>[°F]</b>",
}


def plot_derived(dat, selected):
    fig = make_subplots(rows=len(selected), cols=1)

    for idx, arg in enumerate(selected, 1):
        fig = _match_case[arg](fig, dat, idx)
        fig.update_yaxes(title_text=_axis_labeller[arg], row=idx, col=1)

    x_ticks = [
        dat["datetime"].min() - rd(days=1),
        dat["datetime"].max() + rd(days=1),
    ]
    fig = style_figure(fig, x_ticks, legend=False)
    fig.update_layout(height=max(500, 250 * len(selected)))

    return fig
