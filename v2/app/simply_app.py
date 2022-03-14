from dash import Dash, dcc, html, Input, Output, dash_table, callback_context
import dash_bootstrap_components as dbc
import pandas as pd
import plotly.express as px

from libs.get_data import get_sites, clean_format
from libs.plotting import plot_site, plot_station, plot_wind, plot_latest_ace_image
from libs.tables import make_latest_table, make_metadata_table

from pathlib import Path

app = Dash(
    __name__,
    suppress_callback_exceptions=True,
    # external_stylesheets=[dbc.themes.SLATE]
)
server = app.server


stations = get_sites()

blank_meta_table = pd.DataFrame(
    {
        "c1": [
            "Station Name",
            "Long Name",
            "Date Installed",
            "Sub Network",
            "Longitude",
            "Latitude",
            "Elevation (m)",
        ],
        "c2": ["None", "None", "None", "None", "None", "None", "None"],
    }
)

blank_data_table = pd.DataFrame(
    {
        "c1": [
            "Latest Reading",
            "Air Temperature",
            "Daily Precipitation Total",
            "...",
            "...",
        ],
        "c2": ["None", "None", "None", "...", "..."],
    }
)


def generate_modal():
    return html.Div(
        id="markdown",
        className="modal",
        children=(
            html.Div(
                id="markdown-container",
                className="markdown-container",
                children=[
                    html.Div(
                        className="close-container",
                        children=html.Button(
                            "Close",
                            id="markdown_close",
                            n_clicks=0,
                            className="closeButton",
                        ),
                    ),
                    html.Div(
                        className="markdown-text",
                        children=dcc.Markdown(
                            children=(
                                """
                        Some random info. 
                        
                        Email colin.brust@mso.umt.edu for questions.
                        
                        ###### Source Code
                        See how we built this application at our [Github repository](https://github.com/mt-climate-office/mesonet-dashboard).
                    """
                            )
                        ),
                    ),
                ],
            )
        ),
    )


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
                    dcc.Link(
                        html.Button(
                            id="feedback-button", children="GIVE FEEDBACK", n_clicks=0
                        ),
                        href="https://airtable.com/shrxlaYUu6DcyK98s",
                        refresh=True,
                        target="_blank",
                    ),
                    html.Button(id="help-button", children="HELP", n_clicks=0),
                    html.A(
                        html.Img(id="logo", src=app.get_asset_url("MCO_logo.svg")),
                        href="https://climate.umt.edu/",
                        className="banner-logo",
                    ),
                ],
            ),
        ],
    )


def build_dropdowns():
    return dbc.Card(
        [
            html.Div(
                [
                    dbc.Label("Select a Mesonet Station:"),
                    dcc.Dropdown(
                        dict(
                            zip(
                                stations["station"],
                                stations["long_name"],
                            )
                        ),
                        id="station-dropdown",
                    ),
                ]
            ),
            html.Div(
                [
                    dbc.Label("Select variables to plot:"),
                    dbc.Checklist(
                        options=[
                            {"value": "air_temp", "label": "Air Temperature"},
                            {"value": "ppt", "label": "Precipitation"},
                            {"value": "soil_vwc", "label": "Soil Moisture"},
                            {"value": "soil_temp", "label": "Soil Temperature"},
                            {"value": "sol_rad", "label": "Solar Radiation"},
                            {"value": "rh", "label": "Relative Humidity"},
                            {"value": "wind_spd", "label": "Wind Speed"},
                        ],
                        inline=True,
                        id="select-vars",
                        value=["ppt", "soil_vwc", "air_temp"],
                    ),
                ]
            ),
        ]
    )


def build_map_wind_panel():
    return html.Div(
        id="quick-stats",
        className="five columns",
        children=[
            html.Div(
                id="card-1",
                # TODO: Edit this to use DBC cards.
                children=[
                    html.P("Station Wind Summary"),
                    dcc.RadioItems(
                        [
                            {"label": "Wind Rose", "value": "wind", "disabled": False},
                            {
                                "label": "Station Photo",
                                "value": "photo",
                                "disabled": True,
                            },
                        ],
                        id="radio-select",
                        value="wind",
                        inline=True,
                    ),
                    dcc.Graph(id="wind-rose"),
                ],
            ),
            html.Div(
                id="card-2",
                children=[
                    html.P("Station Location"),
                    dcc.Graph(id="station-map"),
                ],
            ),
        ],
    )


def build_variable_plotting():
    return html.Div(
        id="graphs-container",
        children=[
            build_dropdowns(),
            dcc.Graph(id="station-data"),
        ],
        className="seven columns",
        # style={"display": "flex", "align-items": "center", "justify-content": "center"}
    )


def build_table_panel():
    return html.Div(
        [
            html.Div(
                dash_table.DataTable(
                    blank_meta_table.to_dict("records"), id="meta-tbl", **table_styling
                ),
                className="four columns",
            ),
            html.Div(
                dash_table.DataTable(
                    blank_data_table.to_dict("records"),
                    id="latest-tbl",
                    **table_styling,
                ),
                className="four columns",
            ),
            html.Div(
                html.Iframe(
                    id="wx-frame",
                    src="",
                    style={"height": "250px"},
                    className="four columns",
                )
            ),
        ]
    )


table_styling = {
    "css": [
        {
            "selector": "tr:first-child",
            "rule": "display: none",
        },
    ],
    "style_cell": {"textAlign": "left"},
    "style_data": {"color": "black", "backgroundColor": "white"},
    "style_data_conditional": [
        {"if": {"row_index": "odd"}, "backgroundColor": "rgb(220, 220, 220)"}
    ],
}


app.layout = html.Div(
    [
        dcc.Location(id="url", refresh=False),
        build_banner(),
        html.Div(
            [
                html.Div(
                    id="upper-row",
                    children=[
                        build_map_wind_panel(),
                        build_variable_plotting(),
                    ],
                    className="row",
                ),
                html.Div(
                    id="table-row",
                    children=[build_table_panel()],
                    className="row",
                ),
            ]
        ),
        # Store Temporary
        dcc.Store(id="temp-station-data"),
        generate_modal(),
    ]
)


@app.callback(Output("temp-station-data", "data"), Input("station-dropdown", "value"))
def get_latest_api_data(station):
    if station:
        data = clean_format(station, hourly=False)
        return data.to_json(date_format="iso", orient="records")


@app.callback(Output("radio-select", "options"), Input("station-dropdown", "value"))
def enable_radio(station):

    if station:
        disable = True
        if station[:3] == "ace":
            disable = False
        return [
            {"label": "Wind Rose", "value": "wind", "disabled": False},
            {
                "label": "Station Photo",
                "value": "photo",
                "disabled": disable,
            },
        ]
    return [
        {"label": "Wind Rose", "value": "wind", "disabled": False},
        {
            "label": "Station Photo",
            "value": "photo",
            "disabled": True,
        },
    ]


@app.callback(Output("radio-select", "value"), Input("station-dropdown", "value"))
def reselect_wind(station):
    if station:
        if station[:3] != "ace":
            return "wind"
        return "photo"
    return "wind"


@app.callback(
    Output("station-data", "figure"),
    [Input("temp-station-data", "data"), Input("select-vars", "value")],
)
def render_station_plot(temp_data, select_vars):
    if len(select_vars) == 0:
        return px.line()
    if temp_data:
        data = pd.read_json(temp_data, orient="records")
        hourly = data[data["element"] != "ppt_sum"]
        ppt = data[data["element"] == "ppt_sum"]
        select_vars = [select_vars] if isinstance(select_vars, str) else select_vars
        return plot_site(*select_vars, hourly=hourly, ppt=ppt)
    else:
        return px.line()


@app.callback(
    Output("wind-rose", "figure"),
    [
        Input("temp-station-data", "data"),
        Input("radio-select", "value"),
        Input("station-dropdown", "value"),
    ],
)
def render_wind_plot(temp_data, radio, station):

    if radio == "wind":
        if temp_data:
            data = pd.read_json(temp_data, orient="records")
            data = data[data["element"].str.contains("wind")]
            return plot_wind(data)
        else:
            return px.bar_polar()
    return plot_latest_ace_image(station, direction="N")


@app.callback(Output("station-map", "figure"), Input("station-dropdown", "value"))
def render_station_map(station):

    if station:
        return plot_station(stations, station)
    return px.line()


@app.callback(
    Output("meta-tbl", "data"),
    Input("station-dropdown", "value"),
)
def add_meta_table(station):
    if station:
        return make_metadata_table(stations, station)
    return None


@app.callback(
    Output("latest-tbl", "data"),
    Input("temp-station-data", "data"),
)
def add_latest_table(temp_data):
    if temp_data:
        data = pd.read_json(temp_data, orient="records")
        return make_latest_table(data)
    return None


@app.callback(
    Output("markdown", "style"),
    [Input("help-button", "n_clicks"), Input("markdown_close", "n_clicks")],
)
def update_click_output(button_click, close_click):
    ctx = callback_context
    if ctx.triggered:
        prop_id = ctx.triggered[0]["prop_id"].split(".")[0]
        if prop_id == "help-button":
            return {"display": "block"}

    return {"display": "none"}


@app.callback(Output("wx-frame", "src"), Input("station-dropdown", "value"))
def update_wx_iframe(station):
    if station:
        row = stations[stations["station"] == station]
        url = f"https://mobile.weather.gov/index.php?lon={row['longitude'].values[0]}&lat={row['latitude'].values[0]}"
        return url


# @app.callback(Output("station-dropdown", "value"), Input('url', 'pathname'))
# def update_from_url(pathname):
#     print(pathname.replace('/', ''))
#     if pathname.replace('/', '') not in stations.station:
#         Response("Station does not exist.", 404)
#         return html.Div("This station does not exist")
#     return pathname.replace('/', '')

if __name__ == "__main__":
    app.run_server(debug=True)
