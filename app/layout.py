import datetime as dt

import dash_bootstrap_components as dbc
from dash import dcc, html
from dateutil.relativedelta import relativedelta as rd


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


def build_banner(app_ref):

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
                                            src=app_ref.get_asset_url("MCO_logo.svg"),
                                            height="50px",
                                            alt="MCO Logo",
                                        )
                                    ],
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
                        "The Montana Mesonet Dashboard",
                        id="banner-title",
                        className="bannertxt",
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
            dbc.CardBody(
                html.Div(id="ul-content"),
            ),
        ],
        outline=True,
        color="secondary",
        className="h-100",
        style={"overflow": "scroll"},
    )


def build_bottom_left_card(station_fig):

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
                dbc.CardBody(
                    id="bl-content",
                    children=dcc.Graph(id="station-fig", figure=station_fig),
                    className="card-text",
                ),
                style={"overflow": "scroll"},
            ),
        ],
        outline=True,
        color="secondary",
    )


# TODO: Make this a dbc.FormGroup instead
def build_dropdowns(stations):

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
        className="mb-3",
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
                            # style={"width": "150%"}
                        ),
                        xs=10,
                        sm=10,
                        md=10,
                        lg=3,
                        xl=3,
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
                        ),
                        xs=6,
                        sm=6,
                        md=6,
                        lg=3,
                        xl=3,
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
                        ),
                        xs=6,
                        sm=6,
                        md=6,
                        lg=3,
                        xl=3,
                    ),
                    dbc.Col(
                        dbc.InputGroup(
                            [
                                dbc.Checklist(
                                    options=[
                                        {"label": "Top of Hour Data", "value": 1},
                                    ],
                                    inline=True,
                                    id="hourly-switch",
                                    switch=True,
                                    value=[1],
                                ),
                                dbc.Tooltip(
                                    "Leaving top of the hour data switched on will make the figures load faster. If the toggle is switched off, the figures will convey more information, but will take longer to load.",
                                    target="hourly-switch",
                                ),
                            ],
                        ),
                        xs=10,
                        sm=10,
                        md=10,
                        lg=3,
                        xl=3,
                    ),
                ],
                align="center",
            ),
            html.Br(),
            dbc.Row(
                [
                    dbc.Col(
                        checklist_input,
                        xs=10,
                        sm=10,
                        md=10,
                        lg=9,
                        xl=9,
                    ),
                    dbc.Col(
                        [
                            dbc.InputGroup(
                                dbc.Button(
                                    "Download Data",
                                    href="#",
                                    size="lg",
                                    n_clicks=0,
                                    id="download-button",
                                    className="me-md-2",
                                ),
                            ),
                            dcc.Download(id="data-download"),
                        ],
                        xs=0,
                        sm=0,
                        md=0,
                        lg=3,
                        xl=3,
                        align="start",
                    ),
                ],
                align="center",
            ),
        ],
        style={"padding": "1rem 0rem 0rem 5rem"},
        fluid=True,
    )


def build_right_card(stations):

    return dbc.Card(
        [
            build_dropdowns(stations),
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
        style={"overflow": "scroll"},
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


def app_layout(app_ref, station_fig, stations):
    return dbc.Container(
        [
            dcc.Location(id="url", refresh=False),
            build_banner(app_ref),
            dbc.Row(
                [
                    dbc.Col(
                        [
                            dbc.Row(
                                build_top_left_card(),
                                className="h-50",
                                style={"padding": "0rem 0rem 0.25rem 0rem"},
                            ),
                            dbc.Row(
                                build_bottom_left_card(station_fig),
                                className="h-50",
                                style={"padding": "0.25rem 0rem 0rem 0rem"},
                            ),
                        ],
                        xs={"size": 10, "order": "last", "offset": 0},
                        sm={"size": 10, "order": "last", "offset": 0},
                        md={"size": 10, "order": "last", "offset": 0},
                        lg={"size": 4, "order": "last", "offset": 0},
                        xl={"size": 4, "order": "last", "offset": 0},
                        style={"maxHeight": "92vh", "overflow": "scroll"},
                    ),
                    dbc.Col(
                        html.Div(
                            build_right_card(stations),
                            style={
                                "height": "100%",
                                "maxHeight": "92vh",
                                "overflow": "scroll",
                            },
                        ),
                        xs={"size": 10, "order": "first", "offset": 0},
                        sm={"size": 10, "order": "first", "offset": 0},
                        md={"size": 10, "order": "first", "offset": 0},
                        lg={"size": 8, "order": "first", "offset": 0},
                        xl={"size": 8, "order": "first", "offset": 0},
                        style={"padding": "0rem 0.25rem 0rem 0.5rem"},
                    ),
                ],
                className="h-100",
            ),
            dcc.Store(id="temp-station-data", storage_type="session"),
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
        style={"height": "100%", "backgroundColor": "#E9ECEF"},
    )
