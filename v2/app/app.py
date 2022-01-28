from pprint import pprint
from click import style
import dash
from dash import dcc, html
import plotly.express as px
import json
import plotly.graph_objects as go
from dash.dependencies import Input, Output
from plotly.subplots import make_subplots

from .get_data import get_sites, to_view_format, get_station_latest

# TODO: Multiple endpoints with multiple apps: https://dash.plotly.com/urls

def plot_stations(sites):

    fig = px.scatter_mapbox(
        sites, lat="latitude", lon="longitude", 
        hover_name="name", hover_data=["station"],
        zoom=4.5, height=300
    )
    fig.update_layout(mapbox_style="stamen-terrain")
    fig.update_layout(margin={"r":0,"t":0,"l":0,"b":0})
    return fig

sites = get_sites()
fig = plot_stations(sites)
external_stylesheets = ['https://codepen.io/chriddyp/pen/bWLwgP.css']

app = dash.Dash(__name__, external_stylesheets=external_stylesheets)
server = app.server

app.layout = html.Div([
    dcc.Graph(id="station-data", figure=fig),
    dcc.Graph(id="weather-plots"),
])


def style_figure(fig):
    fig.update_layout({
        'plot_bgcolor': 'rgba(0, 0, 0, 0)',
        'showlegend': False
    })
    fig.update_xaxes(showgrid=True, gridcolor='grey')
    fig.update_yaxes(showgrid=True, gridcolor='grey')
    fig.update_layout(showlegend=False, height=2000, width = 800)

    return fig

def plot_soil(dat):

    fig = px.line(
        dat,
        x='datetime',
        y='value', 
        color='elem_lab',
        # TODO: Refine hover data: https://plotly.com/python/hover-text-and-formatting/
        hover_name='elem_lab',
        hover_data=['value']
    )
    fig.update_traces(connectgaps=False)

    return fig


def plot_met(dat, color):
    fig = px.line(
        dat,
        x='datetime', 
        y='value',
        markers=True
    )

    fig = fig.update_traces(line_color=color, connectgaps=False)
    return fig


def plot_ppt(dat):
    fig = px.bar(
        dat, 
        x='index', 
        y='value'
    )

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

    soil_temp_plot = plot_soil(
        hourly[hourly['element'].str.contains('soil_temp')]
    )
    soil_vwc_plot = plot_soil(
        hourly[hourly['element'].str.contains('soil_vwc')]
    )
    temp_plot = plot_met(
        hourly[hourly['element'].str.contains('air_temp')],
        color='#c42217'
    )
    rh_plot = plot_met(
        hourly[hourly['element'] == 'rh'],
        color='#a16a5c'
    )
    rad_plot = plot_met(
        hourly[hourly['element'] == ('sol_rad')],
        color='#c15366'
    )
    wind_plot = plot_met(
        hourly[hourly['element'].str.contains('wind_spd')],
        color='#ec6607'
    )
    ppt_plot = plot_ppt(ppt)

    return px_to_subplot(
        ppt_plot, soil_vwc_plot, temp_plot, rh_plot, 
        rad_plot, wind_plot, soil_temp_plot,
        shared_xaxes=True
    )




@app.callback(
    Output('weather-plots', 'figure'),
    Input('station-data', 'clickData'))
def display_click_data(clickData):
    # dat = json.load(clickData, indent=2)
    if clickData:
        station = clickData['points'][0]['customdata']
        out = plot_site(station)
        return out
    return style_figure(px.line())
    
if __name__ == '__main__':
    app.run_server(debug=True)  