from dash import Dash, dcc, html, Input, Output, dash_table, State
import dash_bootstrap_components as dbc
import pandas as pd
import plotly.express as px

from libs.get_data import get_sites, clean_format
from libs.plotting import plot_site, plot_station, plot_wind, plot_latest_ace_image
from libs.tables import make_latest_table, make_metadata_table


app = Dash(
    __name__,
    suppress_callback_exceptions=True,
    external_stylesheets=[dbc.themes.BOOTSTRAP],
)
server = app.server

stations = get_sites()


def generate_modal():
    return html.Div(
        dbc.Modal(
            [
                dbc.ModalHeader(dbc.ModalTitle("The Montana Mesonet Dashboard")),
                dbc.ModalBody(
                    dcc.Markdown(
                        """
                        Some random info. 
                        
                        Email colin.brust@mso.umt.edu for questions.
                        
                        ###### Source Code
                        See how we built this application at our [GitHub repository](https://github.com/mt-climate-office/mesonet-dashboard).
                    """
                    )
                ),
            ],
            id="modal",
            is_open=False,
        )
    )


def build_banner():

    return dbc.Navbar(
        dbc.Container(
            [
                html.A(
                    # Use row and col to control vertical alignment of logo / brand
                    dbc.Row(
                        [
                            dbc.Col(
                                html.Img(
                                    src=app.get_asset_url("MCO_logo.svg"), height="50px"
                                )
                            ),
                            dbc.Col(
                                dbc.NavbarBrand(
                                    "Montana Mesonet Dashboard", className="ms-1"
                                )
                            ),
                        ],
                        align="center",
                        className="g-0",
                    ),
                    href="https://climate.umt.edu/",
                    style={"textDecoration": "none"},
                ),
                html.Div(
                    [
                        dbc.Button(
                            "GIVE FEEDBACK",
                            href="https://airtable.com/shrxlaYUu6DcyK98s",
                            size="lg",
                            target="_blank",
                            id="feedback-button",
                            className="me-md-2",
                        ),
                        dbc.Button(
                            "LEARN MORE",
                            href="#",
                            size="lg",
                            n_clicks=0,
                            id="help-button",
                            className="me-md-2",
                        ),
                    ],
                    className="d-grid gap-2 d-md-flex justify-content-md-end",
                ),
            ],
            fluid=True,
        ),
        color="light",
        dark=False,
    )


def build_top_left_card():

    return dbc.Card(
        [
            dbc.CardHeader(
                dbc.Tabs(
                    [
                        dbc.Tab(label="Wind Rose", tab_id="wind-tab"),
                        dbc.Tab(label="Weather Forecast", tab_id="wx-tab"),
                        dbc.Tab(
                            label="Latest Photo", tab_id="photo-tab", disabled=True
                        ),
                    ],
                    id="ul-tabs",
                    active_tab="wind-tab",
                )
            ),
            dbc.CardBody(html.P(id="ul-content", className="card-text")),
        ],
        outline=True,
        color="secondary",
    )


def build_bottom_left_card():

    return dbc.Card(
        [
            dbc.CardHeader(
                dbc.Tabs(
                    [
                        dbc.Tab(label="Locator Map", tab_id="map-tab"),
                        dbc.Tab(label="Station Metadata", tab_id="meta-tab"),
                        dbc.Tab(label="Latest Data", tab_id="data-tab"),
                    ],
                    id="bl-tabs",
                    active_tab="map-tab",
                )
            ),
            html.Div(
                dbc.CardBody(id="bl-content", className="card-text"),
                style={"overflow": "scroll"},
            ),
        ],
        outline=True,
        color="secondary",
    )


def build_dropdowns():

    return dbc.Col(
        dbc.Card(
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
                                {"value": "air_temp", "label": "Air Temp."},
                                {"value": "ppt", "label": "Precipitation"},
                                {"value": "soil_vwc", "label": "Soil Moisture"},
                                {"value": "soil_temp", "label": "Soil Temp."},
                                {"value": "sol_rad", "label": "Solar Rad."},
                                {"value": "rh", "label": "Relative Humidity"},
                                {"value": "wind_spd", "label": "Wind Speed"},
                            ],
                            inline=True,
                            id="select-vars",
                            value=["ppt", "soil_vwc", "air_temp"],
                        ),
                    ]
                ),
            ],
            body=True,
        ),
        width=14,
    )


def build_right_card():

    return dbc.Card(
        [dbc.CardHeader(build_dropdowns()), dbc.CardBody(dcc.Graph(id="station-data"))],
        color="secondary",
        outline=True,
        className="h-100",
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

app.layout = dbc.Container(
    [
        build_banner(),
        dbc.Row(
            [
                dbc.Col(
                    [
                        dbc.Row(
                            build_top_left_card(),
                            className="h-50",
                            style={"padding": "0.5rem 0.5rem"},
                        ),
                        dbc.Row(
                            build_bottom_left_card(),
                            className="h-50",
                            style={"padding": "0.5rem 0.5rem"},
                        ),
                    ],
                    width=4,
                ),
                dbc.Col(
                    html.Div(
                        build_right_card(),
                        style={"maxHeight": "92vh", "overflow": "scroll"},
                    ),
                    width=8,
                    style={"padding": "0.5rem 0.5rem"},
                ),
            ],
            className="h-100",
        ),
        dcc.Store(id="temp-station-data"),
        generate_modal(),
    ],
    fluid=True,
    style={"height": "92vh"},
)


@app.callback(Output("temp-station-data", "data"), Input("station-dropdown", "value"))
def get_latest_api_data(station):
    if station:
        data = clean_format(station, hourly=False)
        return data.to_json(date_format="iso", orient="records")


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


# TODO: Figure out why this isn't working.
@app.callback(Output("ul-tabs", "children"), Input("station-dropdown", "value"))
def enable_photo_tab(station):
    if station:
        disabled = False if station[:3] == "ace" else True
    else:
        disabled = True

    return [
        dbc.Tab(label="Wind Rose", tab_id="wind-tab"),
        dbc.Tab(label="Weather Forecast", tab_id="wx-tab"),
        dbc.Tab(label="Latest Photo", tab_id="photo-tab", disabled=disabled),
    ]


@app.callback(
    Output("ul-content", "children"),
    [
        Input("ul-tabs", "active_tab"),
        Input("station-dropdown", "value"),
        Input("temp-station-data", "data"),
    ],
)
def update_ul_card(at, station, tmp_data):
    if station is None or tmp_data is None:
        return html.Div()

    if at == "wind-tab":
        data = pd.read_json(tmp_data, orient="records")
        data = data[data["element"].str.contains("wind")]
        plt = plot_wind(data)
        return dcc.Graph(figure=plt)
    elif at == "wx-tab":
        row = stations[stations["station"] == station]
        url = f"https://mobile.weather.gov/index.php?lon={row['longitude'].values[0]}&lat={row['latitude'].values[0]}"
        return html.Div(html.Iframe(src=url), className="second-row")
    else:
        plt = plot_latest_ace_image(station, direction="N")
        return dcc.Graph(figure=plt)


@app.callback(
    Output("bl-content", "children"),
    [
        Input("bl-tabs", "active_tab"),
        Input("station-dropdown", "value"),
        Input("temp-station-data", "data"),
    ],
)
def update_bl_card(at, station, tmp_data):
    if station is None or tmp_data is None:
        return html.Div()

    if at == "map-tab":
        plt = plot_station(stations, station)
        return dcc.Graph(figure=plt)
    elif at == "meta-tab":
        table = make_metadata_table(stations, station)
        return (dash_table.DataTable(data=table, **table_styling),)

    else:
        data = pd.read_json(tmp_data, orient="records")
        table = make_latest_table(data)
        return (dash_table.DataTable(data=table, **table_styling),)


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
    Output("modal", "is_open"),
    [Input("help-button", "n_clicks")],
    [State("modal", "is_open")],
)
def toggle_modal(n1, is_open):
    if n1:
        return not is_open
    return is_open


@app.callback(Output("wx-frame", "src"), Input("station-dropdown", "value"))
def update_wx_iframe(station):
    if station:
        row = stations[stations["station"] == station]
        url = f"https://mobile.weather.gov/index.php?lon={row['longitude'].values[0]}&lat={row['latitude'].values[0]}"
        return url


if __name__ == "__main__":
    app.run_server(debug=True)
