from dash import Dash, dcc, html, Input, Output, dash_table, State
import dash_bootstrap_components as dbc
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

import datetime as dt
from dateutil.relativedelta import relativedelta as rd
from pathlib import Path

from .libs.get_data import get_sites, clean_format
from .libs.plotting import plot_site, plot_station, plot_wind, plot_latest_ace_image
from .libs.tables import make_latest_table, make_metadata_table

# from libs.get_data import get_sites, clean_format
# from libs.plotting import plot_site, plot_station, plot_wind, plot_latest_ace_image
# from libs.tables import make_latest_table, make_metadata_table


app = Dash(
    __name__,
    title="Montana Mesonet",
    suppress_callback_exceptions=True,
    external_stylesheets=[dbc.themes.BOOTSTRAP],
    requests_pathname_prefix='/dash/'
)

app._favicon = "MCO_logo.svg"
server = app.server

stations = get_sites()
station_fig = plot_station(stations)


def generate_modal():
    return html.Div(
        dbc.Modal(
            [
                dbc.ModalHeader(dbc.ModalTitle("The Montana Mesonet Dashboard")),
                dbc.ModalBody(
                    dcc.Markdown(
                        """
                        #### Montana Mesonet Background

                        The Montana Climate Office (MCO) is leading the development of a cooperative statewide soil moisture and meteorological information system.
                        It is designed to support decision-making in agriculture, range and forested watershed contexts.
                        This network will add new remote sites and integrate existing cooperator networks to develop the first statewide soil-climate network.

                        The Montana Mesonet will:
                        - Combine information from existing data networks
                        - Establish a minimum of 100 new soil moisture recording sites through partnerships with cooperators.
                        - Provide an information system for accessing and visualizing historic, real-time and forecasted data.

                        #### The Montana Mesonet Dashboard
                        This dashboard visualizes historical data from all stations that are a part of the Montana Mesonet.
                        Data from a given station can either be visualized by selecting a station from the dropdown, click a station on the locator map, or adding a station name to the URL path (e.g. [https://fcfc-mesonet-staging.cfc.umt.edu/dash/crowagen](https://fcfc-mesonet-staging.cfc.umt.edu/dash/crowagen)).
                        If you encounter any bugs, would like to request a new feature, or have a question regarding the dashboard, either:
                        - Email [colin.brust@mso.umt.edu](mailto:colin.brust@mso.umt.edu),
                        - Fill out our [feedback form](https://airtable.com/shrxlaYUu6DcyK98s),
                        - Or open an issue on [our GitHub](https://github.com/mt-climate-office/mesonet-dashboard/issues).      

                        For questions about the Mesonet itself, please contact our Mesonet Director (Kevin Hyde) at [kevin.hyde@umontana.edu](mailto:kevin.hyde@umontana.edu).

                        #### Source Code
                        See how we built this application at our [GitHub repository](https://github.com/mt-climate-office/mesonet-dashboard/tree/develop).
                    """
                    )
                ),
            ],
            id="modal",
            is_open=False,
            size="xl",
            scrollable=True,
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
                                html.A(
                                    href="https://climate.umt.edu/",
                                    children=[
                                        html.Img(
                                            src=app.get_asset_url("MCO_logo.svg"), 
                                            height="50px",
                                            alt="MCO Logo"
                                        )
                                    ]
                                )
                            ),
                            # dbc.Col(
                            #     dbc.NavbarBrand(
                            #         "Montana Mesonet Dashboard", className="ms-5"
                            #     )
                            # ),
                        ],
                        align="center",
                        className="g-0",
                    ),
                    style={"textDecoration": "none"},
                ),
                html.Div(
                    html.P(
                        'The Montana Mesonet Dashboard',
                        id='banner-title',
                        className='bannertxt'
                    )
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
        color="#E9ECEF",
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


# TODO: Make this a dbc.FormGroup instead
def build_dropdowns():

    checklist_input = dbc.InputGroup(
        dbc.InputGroupText(
            [
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
                    value=[
                        "ppt",
                        "soil_vwc",
                        "air_temp",
                    ],
                )
            ]
        ),
        className="mb-1",
        size="lg",
    )

    return dbc.Container(
        [
            dbc.Row(
                [
                    dbc.Col(
                        dcc.Dropdown(
                            dict(
                                zip(
                                    stations["station"],
                                    stations["long_name"],
                                )
                            ),
                            id="station-dropdown",
                            placeholder="Select a Mesonet Station...",
                        )
                    ),
                    dbc.Col(
                        dbc.InputGroup(
                            [
                                dbc.InputGroupText("Start Date"),
                                dcc.DatePickerSingle(
                                    id="start-date",
                                    date=dt.date.today() - rd(weeks=2),
                                    max_date_allowed=dt.date.today(),
                                    disabled=True,
                                ),
                            ]
                        )
                    ),
                    dbc.Col(
                        dbc.InputGroup(
                            [
                                dbc.InputGroupText("End Date"),
                                dcc.DatePickerSingle(
                                    id="end-date",
                                    date=dt.date.today(),
                                    max_date_allowed=dt.date.today(),
                                    disabled=True,
                                ),
                            ]
                        )
                    ),
                    dbc.Col(
                        dbc.Checklist(
                            options=[
                                {"label": "Top of Hour Data", "value": 1},
                            ],
                            inline=True,
                            id="hourly-switch",
                            switch=True,
                            value=[1],
                        ),
                    ),
                ]
            ),
            html.Br(),
            dbc.Row(checklist_input),
        ]
    )


def build_right_card():

    return dbc.Card(
        [
            build_dropdowns(),
            dbc.CardBody(
                html.Div(
                    [
                        # TODO: Create a date range slider as described here: https://community.plotly.com/t/solved-has-anyone-made-a-date-range-slider/6531/8
                        # dcc.RangeSlider(
                        #     dt.date.today() - rd(weeks=2),
                        #     dt.date.today(),
                        # ),
                        dcc.Graph(id="station-data"),
                    ]
                )
            ),
        ],
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
        dcc.Location(id="url", refresh=False),
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
                    style={"maxHeight": "92vh", "overflow": "scroll"},
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
        dbc.Modal(
            id="station-modal",
            is_open=False,
            size="sm",
            centered=True,
            scrollable=True,
        ),
    ],
    fluid=True,
    style={"height": "100vh", "backgroundColor": "#E9ECEF"},
)


def make_nodata_figure():
    fig = go.Figure()
    fig.add_annotation(
        dict(
            font=dict(color="black", size=15),
            x=0.5,
            y=0.5,
            showarrow=False,
            text="No data avaliable for selected dates.",
            textangle=0,
            xanchor="center",
            xref="paper",
            yref="paper",
        )
    )
    return fig

@app.callback(Output("banner-title", "children"), [Input("station-dropdown", "value"), Input("station-dropdown", "options")])
def update_banner_text(station, options):
    return f"The Montana Mesonet Dashboard: {options[station]}" if station else "The Montana Mesonet Dashboard"

@app.callback(
    Output("temp-station-data", "data"),
    [
        Input("station-dropdown", "value"),
        Input("start-date", "date"),
        Input("end-date", "date"),
        Input("hourly-switch", "value"),
    ],
)
def get_latest_api_data(station, start, end, hourly):

    hourly = [hourly] if isinstance(hourly, int) else hourly

    if (start or end) and station:
        start = dt.datetime.strptime(start, "%Y-%m-%d").date()
        end = dt.datetime.strptime(end, "%Y-%m-%d").date()

        try:
            data = clean_format(
                station, hourly=len(hourly) == 1, start_time=start, end_time=end
            )
        except AttributeError:
            return -1
        return data.to_json(date_format="iso", orient="records")


@app.callback(Output("start-date", "disabled"), Input("station-dropdown", "value"))
def enable_start_date(station):
    return station is None


@app.callback(Output("end-date", "disabled"), Input("station-dropdown", "value"))
def enable_end_date(station):
    return station is None


@app.callback(Output("end-date", "max_date_allowed"), [Input("start-date", "date")])
def adjust_end_date_max(value):
    d = dt.datetime.strptime(value, "%Y-%m-%d").date()
    return d + rd(weeks=2)


@app.callback(Output("end-date", "date"), [Input("start-date", "date")])
def adjust_end_date_select(value):
    d = dt.datetime.strptime(value, "%Y-%m-%d").date()
    return d + rd(weeks=2)


@app.callback(Output("start-date", "date"), Input("station-dropdown", "value"))
def reset_start_date(value):
    return dt.date.today() - rd(weeks=2)


@app.callback(Output("end-date", "min_date_allowed"), [Input("start-date", "date")])
def adjust_end_date_max(value):
    d = dt.datetime.strptime(value, "%Y-%m-%d").date()
    return d


@app.callback(
    Output("start-date", "min_date_allowed"), Input("station-dropdown", "value")
)
def adjust_start_date(station):
    if station:
        d = stations[stations["station"] == station]["date_installed"].values[0]
        return dt.datetime.strptime(d, "%Y-%m-%d").date()


@app.callback(Output("date-button", "disabled"), Input("station-dropdown", "value"))
def enable_date_button(station):
    return station is None


@app.callback(
    Output("station-data", "figure"),
    [Input("temp-station-data", "data"), Input("select-vars", "value")],
)
def render_station_plot(temp_data, select_vars):

    if len(select_vars) == 0:
        return make_nodata_figure()

    elif temp_data and temp_data != -1:
        data = pd.read_json(temp_data, orient="records")
        hourly = data[data["element"] != "ppt_sum"]
        ppt = data[data["element"] == "ppt_sum"]
        select_vars = [select_vars] if isinstance(select_vars, str) else select_vars
        return plot_site(*select_vars, hourly=hourly, ppt=ppt)

    return make_nodata_figure()


@app.callback(Output("station-dropdown", "value"), Input("url", "pathname"))
def update_dropdown_from_url(pth):
    stem = Path(pth).stem
    if stem == "/" or "dash" in stem:
        return None
    return stem


@app.callback(Output("ul-tabs", "children"), Input("station-dropdown", "value"))
def enable_photo_tab(station):
    tabs = [
        dbc.Tab(label="Wind Rose", tab_id="wind-tab"),
        dbc.Tab(label="Weather Forecast", tab_id="wx-tab"),
    ]

    if station and station[:3] == "ace":
        tabs.append(dbc.Tab(label="Latest Photo", tab_id="photo-tab"))

    return tabs


@app.callback(Output("ul-tabs", "active_tab"), Input("station-dropdown", "value"))
def select_default_tab(station):
    return "photo-tab" if station and station[:3] == "ace" else "wind-tab"


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
        if tmp_data != -1:
            data = pd.read_json(tmp_data, orient="records")
            data = data[data["element"].str.contains("wind")]
            plt = plot_wind(data)
            return dcc.Graph(figure=plt)
        return dcc.Graph(figure=make_nodata_figure())

    elif at == "wx-tab":
        row = stations[stations["station"] == station]
        url = f"https://mobile.weather.gov/index.php?lon={row['longitude'].values[0]}&lat={row['latitude'].values[0]}"
        return html.Div(html.Iframe(src=url), className="second-row")
    else:
        buttons = dbc.RadioItems(
            id="photo-direction",
            options=[
                {"value": "n", "label": "North"},
                {"value": "s", "label": "South"},
                {"value": "g", "label": "Ground"},
            ],
            inline=True,
            value="n",
        )

        return html.Div(
            [
                dbc.Row(buttons, justify="center", align="center", className="h-50"),
                dcc.Graph(id="photo-figure"),
            ]
        )


@app.callback(
    Output("photo-figure", "figure"),
    [Input("station-dropdown", "value"), Input("photo-direction", "value")],
)
def update_photo_direction(station, direction):
    return plot_latest_ace_image(station, direction=direction)


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
        return dcc.Graph(id="station-fig", figure=station_fig)
    elif at == "meta-tab":
        table = make_metadata_table(stations, station)
        return dash_table.DataTable(data=table, **table_styling)

    else:
        if tmp_data != -1:
            data = pd.read_json(tmp_data, orient="records")
            table = make_latest_table(data)
            return dash_table.DataTable(data=table, **table_styling)
        return dcc.Graph(figure=make_nodata_figure())


@app.callback(
    [Output("station-modal", "children"), Output("station-modal", "is_open")],
    [Input("station-fig", "clickData")],
    [State("station-modal", "is_open")],
)
def station_popup(clickData, is_open):

    if clickData:
        lat, lon, name, elevation, href, _ = clickData['points'][0]['customdata']
        name = name.replace(',<br>', ', ')
        text = dbc.ModalBody(dcc.Markdown(
            f"""
            #### {name}
            **Latitude, Longitude**: {lat}, {lon}

            **Elevation (m)**: {elevation}

            ###### View Station Dashboard
            {href}
            """
        ))


    if clickData and text:
        return text, not is_open
    return '', is_open


@app.callback(
    Output("modal", "is_open"),
    [Input("help-button", "n_clicks")],
    [State("modal", "is_open")],
)
def toggle_modal(n1, is_open):
    if n1:
        return not is_open
    return is_open


if __name__ == "__main__":
    app.run_server(debug=True)
