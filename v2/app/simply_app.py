from select import select
from dash import Dash, dcc, html, Input, Output, callback
import pandas as pd
import plotly.express as px

from libs.get_data import get_sites, clean_format
from libs.plotting import plot_site

from pathlib import Path

external_stylesheets = ["https://codepen.io/chriddyp/pen/bWLwgP.css"]
app = Dash(
    __name__,
    suppress_callback_exceptions=True,
    external_stylesheets=external_stylesheets,
)
server = app.server


stations = get_sites()


def build_banner():
    return html.Div(
        id="banner",
        className="banner",
        children=[
            html.Div(
                id="banner-text",
                children=[
                    html.H5("Montana Mesonet Dashboard"),
                    html.H6("Download and View Data from Montana Weather Stations"),
                ],
            ),
            html.Div(
                id="banner-logo",
                children=[
                    # TODO: a Modal to make this button render popup: https://github.com/plotly/dash-sample-apps/blob/main/apps/dash-manufacture-spc-dashboard/app.py#L234
                    html.Button(
                        id="feedback-button", children="GIVE FEEDBACK", n_clicks=0
                    ),
                    html.Button(id="help-button", children="HELP", n_clicks=0),
                    html.A(
                        html.Img(id="logo", src=app.get_asset_url("MCO_logo.svg")),
                        href="https://climate.umt.edu/",
                    ),
                ],
            ),
        ],
    )


app.layout = html.Div(
    [
        # dcc.Location(id="url", refresh=False), 
        build_banner(),
        html.Div(
            [
            dcc.Dropdown(
                dict(
                    zip(
                        stations['station'],
                        stations["long_name"],
                    )
                ),
                id="station-dropdown",
            ),
            dcc.Dropdown(
                {
                    'air_temp': 'Air Temperature',
                    'ppt': 'Precipitation',
                    'wind_spd': 'Wind Speed',
                    'soil_vwc': 'Soil Moisture',
                    'soil_temp': 'Soil Temperature',
                    'sol_rad': 'Solar Radiation',
                    'rh': 'Relative Humidity',
                },
                id="select-vars",
                multi=True, 
                value = 'air_temp'
            ),
            dcc.Graph(id="station-data", figure=px.line()),
            ]
        ),

        dcc.Store(id='temp-station-data')
    ]
)

@app.callback(Output("temp-station-data", "data"), Input("station-dropdown", "value"))
def get_latest_api_data(station):
    if station:
        data = clean_format(station, hourly=True)
        return data.to_json(date_format='iso', orient='records')
    else:
        print('No station')


@app.callback(
    Output('station-data', 'figure'), 
    [Input('temp-station-data', 'data'),
    Input('select-vars', 'value')]
)
def plot_station_data(temp_data, select_vars):
    
    if temp_data:
        data = pd.read_json(temp_data, orient='records')
        hourly = data[data['element'] != 'ppt']
        ppt = data[data['element'] == 'ppt']

        select_vars = list(select_vars) if isinstance(select_vars, str) else select_vars
        print(type(select_vars))
        a = plot_site(*select_vars if len(select_vars) > 1 else select_vars, hourly=hourly, ppt=ppt)
        print('I made a plot')
        return a
    else:
        print('No vars')

# @callback(Output("selected-site", "children"), Input("station-dropdown", "value"))
# def display_value(value):
#     return f"You have selected {value}"



if __name__ == "__main__":
    app.run_server(debug=True)
