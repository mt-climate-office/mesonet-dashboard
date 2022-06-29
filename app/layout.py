import datetime as dt

import dash_bootstrap_components as dbc
from dash import dcc, html
from dateutil.relativedelta import relativedelta as rd


def generate_modal():
    return html.Div(
        dbc.Modal(
            [
                dbc.ModalHeader(dbc.ModalTitle("")),
                dbc.ModalBody(
                    dcc.Markdown(
                        """
                        #### The Montana Mesonet Dashboard
                        Welcome to the Montana Mesonet Dashboard! This dashboard visualizes historical data from all stations that are a part of the Montana Mesonet.
                        To visualize data from a station, either select a station from the dropdown on the top left, click a station on the locator map, or add a station name to the URL path (e.g. [https://mesonet.climate.umt.edu/dash/crowagen](https://mesonet.climate.umt.edu/dash/crowagen)).
                        The station data is aggregated on demand from the [Montana Mesonet API](https://mesonet.climate.umt.edu/api/v2/docs). If you encounter any bugs, would like to request a new feature, or have a question regarding the dashboard, please:
                        - Email [colin.brust@mso.umt.edu](mailto:colin.brust@mso.umt.edu),
                        - Fill out our [feedback form](https://airtable.com/shrxlaYUu6DcyK98s),
                        - Or open an issue on [our GitHub](https://github.com/mt-climate-office/mesonet-dashboard/issues).      

                        For questions or issues related to current Mesonet stations, please contact our Mesonet Manager (Kevin Hyde) at
                        [kevin.hyde@umontana.edu](mailto:kevin.hyde@umontana.edu). For general questions about the Mesonet and its development,
                        please contact the state climatologist (Kelsey Jencso) at [kelsey.jencso@umontana.edu](mailto:kelsey.jencso@umontana.edu).

                        #### Montana Mesonet Background
                        The Montana Climate Office (MCO) installed 6 weather and soil moisture monitoring stations in 2016 as part of the Montana Research 
                        and Economic Development Initiative (MREDI). The Mesonet was designed to support decision-making for statewide drought assessments, 
                        precision agriculture and rangeland and forested watershed management. Since 2016 the network has grown to 94 stations through support
                        from private landowners, watershed groups, tribes, state agencies and grants from federal entities. In 2020 the MCO was awarded a contract 
                        from the U.S. Army Corps to add 205 additional stations. The new stations will be installed every 500 square miles in central and eastern
                        Montana to improve drought assessments and flood forecasting - in the protection of lives and property.
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


def feedback_iframe():
    return html.Div(
        dbc.Modal(
            [
                dbc.ModalHeader(
                    dbc.ModalTitle("Provide Feedback to Improve Our Dashboard!")
                ),
                dbc.ModalBody(
                    html.Iframe(
                        src="https://airtable.com/embed/shrxlaYUu6DcyK98s?",
                        style={
                            "backgroundColor": "orange",
                            "frameborder": "0",
                            "onmousewheel": "",
                            "width": "100%",
                            "height": "90vh",
                            "background": "transparent",
                            "border": "2px solid #ccc",
                        },
                    ),
                    style={"overflow": "clip"},
                ),
            ],
            id="feedback-modal",
            is_open=False,
            size="xl",
            scrollable=True,
            style={"max-height": "none", "height": "100%"},
        ),
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
                            "MESONET DOWNLOADER",
                            href="https://shiny.cfc.umt.edu/mesonet-download/",
                            size="lg",
                            n_clicks=0,
                            id="shiny-download-button",
                            className="me-md-2",
                            target="_blank",
                        ),
                        dbc.Button(
                            "GIVE FEEDBACK",
                            href="#",
                            size="lg",
                            n_clicks=0,
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
                    className="d-inline-flex gap-2",
                    style={"padding": "0rem 0rem 0rem 0rem"},
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
        style={"overflow": "clip"},
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
                # style={"overflow": "scroll"},
            ),
        ],
        outline=True,
        color="secondary",
    )


def make_station_dropdowns(stations, id):
    return dbc.Col(
        dcc.Dropdown(
            dict(
                zip(
                    stations["station"],
                    stations["long_name"],
                )
            ),
            id=id,
            placeholder="Select a Mesonet Station...",
            className="stationSelect"
            # style={"width": "150%"}
        ),
        xs=10,
        sm=10,
        md=10,
        lg=3,
        xl=3,
    )


def build_dropdowns(stations):

    checklist_input = dbc.InputGroup(
        dbc.InputGroupText(
            [
                dbc.Checklist(
                    options=[
                        {"value": "Precipitation", "label": "Precipitation"},
                        {"value": "ET", "label": "Reference ET"},
                        {"value": "Soil VWC", "label": "Soil Moisture"},
                        {"value": "Air Temperature", "label": "Air Temperature"},
                        {"value": "Solar Radiation", "label": "Solar Radiation"},
                        {"value": "Soil Temperature", "label": "Soil Temperature"},
                        {"value": "Relative Humidity", "label": "Relative Humidity"},
                        {"value": "Wind Speed", "label": "Wind Speed"},
                        {
                            "value": "Atmospheric Pressure",
                            "label": "Atmospheric Pressure",
                        },
                    ],
                    inline=True,
                    id="select-vars",
                    value=[
                        "Precipitation",
                        "ET",
                        "Soil VWC",
                        "Air Temperature",
                    ],
                )
            ],
            style={"overflow-x": "scroll"},
        ),
        className="mb-3",
        size="lg",
    )

    return dbc.Container(
        [
            dbc.Row(
                [
                    make_station_dropdowns(stations, "station-dropdown"),
                    dbc.Col(
                        dbc.InputGroup(
                            [
                                dbc.InputGroupText("Start Date"),
                                dcc.DatePickerSingle(
                                    id="start-date",
                                    date=dt.date.today() - rd(weeks=2),
                                    max_date_allowed=dt.date.today(),
                                    min_date_allowed=dt.date(2022, 1, 1),
                                    disabled=True,
                                ),
                            ]
                        ),
                        xs=5,
                        sm=5,
                        md=5,
                        lg=3,
                        xl=3,
                        # style={"padding": "0rem 0rem 0rem 6.5rem"},
                    ),
                    dbc.Col(
                        dbc.InputGroup(
                            [
                                dbc.InputGroupText("End Date"),
                                dcc.DatePickerSingle(
                                    id="end-date",
                                    date=dt.date.today(),
                                    max_date_allowed=dt.date.today(),
                                    min_date_allowed=dt.date(2022, 1, 1),
                                    disabled=True,
                                ),
                            ]
                        ),
                        xs=5,
                        sm=5,
                        md=5,
                        lg=3,
                        xl=3,
                        # style={"padding": "0rem 0rem 0rem 6.5rem"},
                    ),
                    dbc.Col(
                        dbc.Row(
                            [
                                dbc.InputGroup(
                                    [
                                        dbc.Checklist(
                                            options=[
                                                {"label": "Hourly", "value": 1},
                                            ],
                                            inline=True,
                                            id="hourly-switch",
                                            switch=True,
                                            value=[1],
                                            # className="toggle",
                                        ),
                                        dbc.Tooltip(
                                            """Leaving this switched on will return hourly averages (totals for precipitation). 
                                            This significantly cuts down on data transfer and makes the plots render faster.
                                            If the toggle is switched off, the figures will have higher resolution data, but will take longer to load.""",
                                            target="hourly-switch",
                                        ),
                                    ],
                                ),
                                dbc.InputGroup(
                                    [
                                        dbc.Checklist(
                                            options=[
                                                {
                                                    "label": "gridMET Normals",
                                                    "value": 1,
                                                },
                                            ],
                                            inline=True,
                                            id="gridmet-switch",
                                            switch=True,
                                            value=[],
                                            # className="toggle",
                                        ),
                                        dbc.Tooltip(
                                            "This toggle shows the 1991-2020 gridMET climate normals around each applicable variable to contextualize current conditions.",
                                            target="gridmet-switch",
                                        ),
                                    ],
                                ),
                            ],
                            align="center",
                        ),
                        xs=10,
                        sm=10,
                        md=10,
                        lg=3,
                        xl=3,
                        # style={"padding": "0rem 0rem 0rem 5rem"},
                    ),
                ],
                align="end",
            ),
            html.Br(),
            dbc.Row(
                [
                    dbc.Col(
                        checklist_input,
                        xs=12,
                        sm=12,
                        md=12,
                        lg=12,
                        xl=12,
                    ),
                ],
                align="center",
                style={"padding": "0rem 6.5rem 0rem 0rem"},
            ),
        ],
        style={"padding": "1rem 0rem 0rem 5rem"},
        fluid=True,
    )


def build_right_card(stations):

    selectors = build_dropdowns(stations)

    return dbc.Card(
        [
            selectors,
            dbc.CardBody(
                html.Div(
                    [
                        dcc.Graph(id="station-data"),
                    ]
                )
            ),
        ],
        color="secondary",
        outline=True,
        className="h-100",
        style={"overflow-y": "scroll", "overflow-x": "clip"},
    )


def build_latest_content(station_fig, stations):
    return [
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
            xs={"size": 12, "order": "last", "offset": 0},
            sm={"size": 12, "order": "last", "offset": 0},
            md={"size": 12, "order": "last", "offset": 0},
            lg={"size": 4, "order": "last", "offset": 0},
            xl={"size": 4, "order": "last", "offset": 0},
            style={
                "maxHeight": "92vh",
                "overflow-y": "scroll",
                "overflow-x": "clip",
            },
        ),
        dbc.Col(
            html.Div(
                build_right_card(stations),
                style={
                    "height": "100%",
                    "maxHeight": "92vh",
                    # "overflow": "scroll",
                },
                id="latest-plots",
            ),
            xs={"size": 12, "order": "first", "offset": 0},
            sm={"size": 12, "order": "first", "offset": 0},
            md={"size": 12, "order": "first", "offset": 0},
            lg={"size": 8, "order": "first", "offset": 0},
            xl={"size": 8, "order": "first", "offset": 0},
            style={"padding": "0rem 0.5rem 0rem 0.5rem"},
        ),
    ]


def build_satellite_dropdowns(stations):

    return dbc.Container(
        [
            dbc.Row(
                [
                    dbc.Col(
                        make_station_dropdowns(stations, "station-dropdown-satellite"),
                    ),
                    dbc.Col(
                        [
                            dbc.Checklist(
                                options=[
                                    {"value": "ET", "label": "ET"},
                                    {"value": "PET", "label": "PET"},
                                    {
                                        "label": "Surface Soil Moisture",
                                        "value": "sm_surface",
                                    },
                                    {
                                        "label": "Surface Soil Wetness",
                                        "value": "sm_surface_wetness",
                                    },
                                    {
                                        "label": "Rootzone Soil Moisture",
                                        "value": "sm_rootzone",
                                    },
                                    {
                                        "label": "Rootzone Soil Wetness",
                                        "value": "sm_rootzone_wetness",
                                    },
                                    {"value": "GPP", "label": "GPP"},
                                    {"value": "NDVI", "label": "NDVI"},
                                    {"value": "EVI", "label": "EVI"},
                                    {"value": "Fpar", "label": "FPAR"},
                                    {"value": "LAI", "label": "LAI"},
                                ],
                                inline=True,
                                id="sat-vars",
                                value=[
                                    "NDVI",
                                    "ET",
                                    "GPP",
                                ],
                            ),
                        ]
                    ),
                ],
                align="center",
            ),
        ],
        fluid=True,
    )


def build_satellite_content(stations):

    selectors = build_satellite_dropdowns(stations)
    return dbc.Card(
        [
            selectors,
            dbc.CardBody(
                html.Div(
                    [
                        dcc.Graph(id="satellite-plot"),
                    ]
                )
            ),
        ],
        color="secondary",
        outline=True,
        className="h-100",
        style={"overflow-y": "scroll", "overflow-x": "clip"},
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


def app_layout(app_ref):
    return dbc.Container(
        [
            dcc.Location(id="url", refresh=False),
            build_banner(app_ref),
            dcc.Tabs(
                [
                    dcc.Tab(
                        label="Latest Data Dashboard",
                        id="station-tab",
                        value="station-tab",
                    ),
                    dcc.Tab(
                        label="Satellite Indicators Dashboard",
                        id="satellite-tab",
                        value="satellite-tab",
                    ),
                ],
                id="main-display-tabs",
                value="station-tab",
            ),
            dbc.Row(className="h-100", id="main-content"),
            dcc.Store(id="temp-station-data", storage_type="session"),
            generate_modal(),
            feedback_iframe(),
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
