from dash import Dash, dcc, html, Input, Output, dash_table, State
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
    external_stylesheets=[dbc.themes.BOOTSTRAP],
)
server = app.server

stations = get_sites()


def generate_modal():
    return html.Div(
        dbc.Modal(
            [
                dbc.ModalHeader(dbc.ModalTitle("The Montana Mesonet Dashboard")),
                dbc.ModalBody(dcc.Markdown("""
                        Some random info. 
                        
                        Email colin.brust@mso.umt.edu for questions.
                        
                        ###### Source Code
                        See how we built this application at our [Github repository](https://github.com/mt-climate-office/mesonet-dashboard).
                    """)),
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
            fluid=True
        ),
        color="light",
        dark=False,
    )

def build_left_card():

    # upper_card = [
    #     html.P("Station Wind Summary", id="wind-photo-header", className="card-title"),
    #             dbc.RadioItems(
    #                 options=[
    #                     {"label": "Wind Rose", "value": "wind", "disabled": False},
    #                     {
    #                         "label": "Station Photo",
    #                         "value": "photo",
    #                         "disabled": True,
    #                     },
    #                 ],
    #                 id="radio-select",
    #                 value="wind",
    #                 inline=True,
    #             ),
    #             dcc.Graph(id="wind-rose"),
    # ]

    # lower_card = [
    #     html.P("Station Location", className="card-title"),
    #     dcc.Graph(id="station-map")
    # ]


    return dbc.Col([
        dbc.Row(upper_card),
        dbc.Row(lower_card),
    ], class_name="h-75", width=4)



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
        color="secondary", outline=True
    )


def build_right_card():

    return html.Div([
        # dbc.Row(build_dropdowns),
        dbc.Row(
            dbc.Card(
                dbc.CardBody(
                    dcc.Graph(id="station-data")
                ),
                color="secondary", outline=True
            )
        )
    ])


def build_table_panel():
    return html.Div(
        [
            html.Div(
                dash_table.DataTable(id="meta-tbl", **table_styling),
                className="four columns",
            ),
            html.Div(
                dash_table.DataTable(
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

test = [
        html.P("Station Wind Summary", id="wind-photo-header", className="card-title"),
                dbc.RadioItems(
                    options=[
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
    ]

app.layout = dbc.Container(
    [
        build_banner(),
        dbc.Row(
            [
                dbc.Col(
                    [
                        dbc.Row(
                            children=test,
                            className='h-50',
                            style={"background-color": "pink"}

                        ),
                        dbc.Row(
                            html.P("locator/tables"),
                            className='h-50',
                            style={"background-color": "red"}
                        )
                    ],
                width=4),
                dbc.Col(
                    html.P("main chart"),
                    width=8,
                    style={"height": "100%", "background-color": "green"},
                ),
            ],
            className="h-100",
        ),
    ],
    fluid=True,
    style={"height": "92vh"},
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


# @app.callback(Output("station-dropdown", "value"), Input('url', 'pathname'))
# def update_from_url(pathname):
#     print(pathname.replace('/', ''))
#     if pathname.replace('/', '') not in stations.station:
#         Response("Station does not exist.", 404)
#         return html.Div("This station does not exist")
#     return pathname.replace('/', '')

if __name__ == "__main__":
    app.run_server(debug=True)
