import plotly.express as px
from plotly.subplots import make_subplots

from get_data import to_view_format


def style_figure(fig):
    fig.update_layout({"plot_bgcolor": "rgba(0, 0, 0, 0)", "showlegend": False})
    fig.update_xaxes(showgrid=True, gridcolor="grey")
    fig.update_yaxes(showgrid=True, gridcolor="grey")
    fig.update_layout(showlegend=False, height=2000, width=800)

    return fig


def plot_soil(dat):

    fig = px.line(
        dat,
        x="datetime",
        y="value",
        color="elem_lab",
        # color_discrete_sequence=['yellow', 'blue', 'pink', 'skyblbue'],
        # TODO: Refine hover data: https://plotly.com/python/hover-text-and-formatting/
        hover_name="elem_lab",
        hover_data=["value"],
    )
    fig.update_traces(connectgaps=False)

    return fig


def plot_met(dat, color):
    fig = px.line(dat, x="datetime", y="value", markers=True)

    fig = fig.update_traces(line_color=color, connectgaps=False)
    return fig


def plot_ppt(dat):
    fig = px.bar(dat, x="index", y="value")

    return fig


def px_to_subplot(*figs, **kwargs):
    """
    Converts a list of plotly express figures (*figs) into a subplot with 1 column.

    Returns:
        A single plotly subplot.
    """
    fig_traces = []

    for fig in figs:
        traces = []
        for trace in range(len(fig["data"])):
            traces.append(fig["data"][trace])
        fig_traces.append(traces)

    sub = make_subplots(rows=len(figs), cols=1, **kwargs)
    for idx, traces in enumerate(fig_traces, start=1):
        if len(traces) > 0:
            for trace in traces:
                sub.append_trace(trace, row=idx, col=1)
        else:
            sub.add_trace(*traces, row=idx, col=1)

    return style_figure(sub)


def plot_site(station):

    # TODO: Add NaN values into missing data?
    hourly, ppt = to_view_format(station)

    soil_temp_plot = plot_soil(hourly[hourly["element"].str.contains("soil_temp")])
    soil_vwc_plot = plot_soil(hourly[hourly["element"].str.contains("soil_vwc")])
    temp_plot = plot_met(
        hourly[hourly["element"].str.contains("air_temp")], color="#c42217"
    )
    rh_plot = plot_met(hourly[hourly["element"] == "rh"], color="#a16a5c")
    rad_plot = plot_met(hourly[hourly["element"] == ("sol_rad")], color="#c15366")
    wind_plot = plot_met(
        hourly[hourly["element"].str.contains("wind_spd")], color="#ec6607"
    )
    ppt_plot = plot_ppt(ppt)

    sub = px_to_subplot(
        ppt_plot,
        soil_vwc_plot,
        temp_plot,
        rh_plot,
        rad_plot,
        wind_plot,
        soil_temp_plot,
        shared_xaxes=True,
    )

    sub.update_yaxes(title_text="Daily Precipitation Total<br>(in)", row=1, col=1)
    sub.update_yaxes(title_text="Soil Moisture<br>(%)", row=2, col=1)
    sub.update_yaxes(title_text="Air Temperature<br>(°F)", row=3, col=1)
    sub.update_yaxes(title_text="Relative Humidity<br>(%)", row=4, col=1)
    sub.update_yaxes(title_text="Solar Radiation<br>(W/m<sup>2</sup>)", row=5, col=1)
    sub.update_yaxes(title_text="Wind Speed<br>(mph)", row=6, col=1)
    sub.update_yaxes(title_text="Soil Temperature<br>(°F)", row=7, col=1)

    return sub
