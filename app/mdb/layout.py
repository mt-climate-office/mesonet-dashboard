import datetime as dt

import dash_bootstrap_components as dbc
import dash_loading_spinners as dls
import dash_mantine_components as dmc
from dash import dcc, html
from dash_iconify import DashIconify
from dateutil.relativedelta import relativedelta as rd

TABLE_STYLING = {
    "css": [{"selector": "tr:first-child", "rule": "display: none"}],
    "style_cell": {"textAlign": "left"},
    "style_data": {"color": "black", "backgroundColor": "white"},
    "style_data_conditional": [
        {"if": {"row_index": "odd"}, "backgroundColor": "rgb(220, 220, 220)"}
    ],
}

TAB_STYLE = {
    "width": "inherit",
    "borderTop": "1px black solid",
    # 'borderBottom': '1px black solid',
    "background": "white",
    "paddingTop": 0,
    "paddingBottom": 0,
    # 'height': '100px',
    "line-height": "4.5vh",
}

SELECTED_STYLE = {
    "width": "inherit",
    # "boxShadow": "none",
    "borderTop": "3px #0B5ED7 solid",
    # 'borderBottom': '1px black solid',
    "boxShadow": "inset 0px -1px 0px 0px lightgrey",
    "background": "#E9ECEF",
    "paddingTop": 0,
    "paddingBottom": 0,
    # 'height': '42px',
    "line-height": "4.5vh",
}


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
                        The station data is aggregated on demand from the [Montana Mesonet API](https://mesonet.climate.umt.edu/api/v2/docs).
                        
                        The "Satellite Indicators" tab uses data from NASA satellites to provide timeseries of relevant indicators at all Mesonet stations. 
                        To display data on this tab, select a station from the dropdown on the left. Selecting the "Timeseries" button shows a timeseries of a given variable for the current year, with previous years plotted as grey lines in the background for context.
                        Selecting the "Comparison" button allows you to choose two variable to plot against one another for the current year. 
                        If you encounter any bugs, would like to request a new feature, or have a question regarding the dashboard, please:
                        - Email [colin.brust@mso.umt.edu](mailto:colin.brust@mso.umt.edu),
                        - Fill out our [feedback form](https://airtable.com/appUacO5Pq7wZYoJ3/pagqtNp2dSSjhkUkN/form),
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
                        See how we built this application at our [GitHub repository](https://github.com/mt-climate-office/mesonet-dashboard/tree/main).
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
                    dbc.ModalTitle("Provide Feedback to Improve Our Dashboard")
                ),
                dbc.ModalBody(
                    html.Iframe(
                        src="https://airtable.com/embed/appUacO5Pq7wZYoJ3/pagqtNp2dSSjhkUkN/form",
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
                                            id="pls-work",
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
                        dbc.Button(
                            "SHARE PLOT",
                            href="#",
                            size="lg",
                            n_clicks=0,
                            id="test-button",
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
                        dbc.Tab(label="Wind Rose", id="wind-tab"),
                        dbc.Tab(label="Weather Forecast", id="wx-tab"),
                        dbc.Tab(label="Latest Photo", id="photo-tab", disabled=True),
                    ],
                    id="ul-tabs",
                    active_tab="wind-tab",
                )
            ),
            dbc.CardBody(html.Div(id="ul-content")),
            # dbc.Tooltip(
            #     """ A wind rose shows the aggregated wind conditions over the selected time period.
            #     The size of the colored boxes shows how frequently a range of wind speeds occurred,
            #     the color of the box shows how fast those wind speeds were and the orientation of
            #     the boxes on the wind rose shows which direction that wind was coming from.""",
            #     target="wind-tab",
            # ),
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
                        dbc.Tab(label="Current Conditions", tab_id="data-tab"),
                    ],
                    id="bl-tabs",
                    active_tab="data-tab",
                )
            ),
            html.Div(
                children=dbc.CardBody(
                    id="bl-content",
                    children=html.Div(id="station-fig", children=station_fig),
                    className="card-text",
                ),
                # style={"overflow": "scroll"},
            ),
        ],
        id="bl-card",
        outline=True,
        color="secondary",
    )


def make_station_dropdowns(stations, id, station):
    return dbc.Select(
        options=[
            {"label": k, "value": v}
            for k, v in zip(stations["long_name"], stations["station"])
        ],
        id=id,
        placeholder="Select a Mesonet Station...",
        # className="stationSelect",
        value=station,
        # style={"width": "150%"}
    )


def build_dropdowns(stations):
    checklist_input = dbc.InputGroup(
        dbc.InputGroupText(
            [
                dbc.Checklist(
                    inline=True,
                    id="select-vars",
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
                    dbc.Col(
                        make_station_dropdowns(stations, "station-dropdown", None),
                        width="auto",
                    ),
                    dbc.Col(
                        dbc.InputGroup(
                            [
                                dcc.DatePickerRange(
                                    id="dates",
                                    month_format="MMMM Y",
                                    start_date=dt.date.today() - rd(days=14),
                                    end_date=dt.date.today(),
                                    clearable=False,
                                    max_date_allowed=dt.date.today(),
                                    stay_open_on_select=False,
                                )
                            ]
                        ),
                        width="auto",
                    ),
                    dbc.Col(
                        dbc.Button(
                            "Display Period of Record",
                            id="por-button",
                        ),
                        width="auto",
                    ),
                ],
                style={"padding": "0.5rem"},  # Add some padding to the row
                justify="around",
            ),
            # html.Br(),
            dbc.Row(
                [
                    dbc.Col(
                        dbc.InputGroup(
                            [
                                dbc.RadioItems(
                                    options=[
                                        {"label": "Hourly", "value": "hourly"},
                                        {"label": "Daily", "value": "daily"},
                                        {"label": "Raw", "value": "raw"},
                                    ],
                                    inline=True,
                                    id="hourly-switch",
                                    value="hourly",
                                ),
                                dbc.Tooltip(
                                    """Hourly and daily averages are pre-computed and will take much less time to render plots. 
                                        It is not recommended to select a time period longer than 1 year for daily data, 3 months for hourly
                                        data, or 2 weeks for raw data. Longer time selections could take up to a few minutes to load.""",
                                    target="hourly-switch",
                                ),
                            ]
                        ),
                        width="auto",  # Adjust column width
                    ),
                    dbc.Col(
                        dbc.InputGroup(
                            [
                                dbc.Checklist(
                                    options=[
                                        {
                                            "label": "gridMET Normals",
                                            "value": 1,
                                            "disabled": True,
                                        }
                                    ],
                                    inline=True,
                                    id="gridmet-switch",
                                    switch=True,
                                    value=[],
                                ),
                                dbc.Tooltip(
                                    "This toggle shows the 1991-2020 gridMET climate normals around each applicable variable to contextualize current conditions. **Note** This is only available on daily data.",
                                    target="gridmet-switch",
                                ),
                            ]
                        ),
                        width="auto",  # Adjust column width
                    ),
                    dbc.Col(
                        dbc.InputGroup(
                            [
                                dbc.Checklist(
                                    options=[
                                        {
                                            "label": "HydroMet",
                                            "value": "HydroMet",
                                        },
                                        {
                                            "label": "AgriMet",
                                            "value": "AgriMet",
                                        },
                                    ],
                                    inline=True,
                                    id="network-options",
                                    value=["HydroMet", "AgriMet"],
                                ),
                                dbc.Tooltip(
                                    """These checkboxes allow you to subset the stations listed in the dropdown. 
                                        Leaving both boxes checked shows all possible stations. Checking either HydroMet or
                                        AgriMet subsets selectable stations to only the respective network.""",
                                    target="network-options",
                                ),
                            ]
                        ),
                        width="auto",
                    ),
                    dbc.Col(
                        dbc.Button(
                            "ABOUT THESE VARIABLES",
                            href="https://climate.umt.edu/mesonet/variables/",
                            target="_blank",
                        ),
                        width="auto",
                    ),
                ],
                style={"padding": "0.5rem"},  # Add some padding to the row
                justify="around",
            ),
            dbc.Row(
                [dbc.Col(checklist_input, width="auto")],
                style={"padding": "0.5rem"},  # Add some padding to the row
                justify="around",
            ),
        ],
        style={"padding": "0rem"},  # Adjust overall padding
        fluid=True,
    )


def build_right_card(stations):
    selectors = build_dropdowns(stations)

    return dbc.Card(
        [
            dbc.CardHeader(selectors),
            dbc.CardBody(
                html.Div(
                    [
                        dls.Bars(
                            children=[
                                dcc.Store(
                                    id="temp-station-data", storage_type="session"
                                ),
                                dcc.Graph(id="station-data"),
                            ]
                        )
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
                    id="top-card",
                ),
                dbc.Row(
                    build_bottom_left_card(station_fig),
                    className="h-50",
                    style={"padding": "0.25rem 0rem 0rem 0rem"},
                    id="bottom-card",
                ),
            ],
            xs={"size": 12, "order": "last", "offset": 0},
            sm={"size": 12, "order": "last", "offset": 0},
            md={"size": 12, "order": "last", "offset": 0},
            lg={"size": 4, "order": "last", "offset": 0},
            xl={"size": 4, "order": "last", "offset": 0},
            style={"maxHeight": "92vh", "overflow-y": "scroll", "overflow-x": "clip"},
            id="sub-cards",
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
            style={"padding": "0rem 0.5rem 0rem 0rem"},
        ),
    ]


def build_downloader_content(
    station_fig, stations, elements, station=None, min_date=None
):
    station_dd = dmc.Select(
        data=[
            {"label": k, "value": v}
            for k, v in zip(stations["long_name"], stations["station"])
        ],
        id="station-dropdown-dl",
        placeholder="Select a Mesonet Station from the Map or Dropdown...",
        value=station,
        label="Select Station",
        searchable=True,
        clearable=True,
        # style={"width": "150%"}
    )
    element_dd = dmc.MultiSelect(
        data=elements,
        id="download-elements",
        clearable=True,
        value=None,
        label="Select Variable(s)",
        searchable=True,
        # style={"width": 400, "marginBottom": 10},
    )
    times = [
        {"value": "monthly", "label": "Monthly"},
        {"value": "daily", "label": "Daily"},
        {"value": "hourly", "label": "Hourly"},
        # {"value": "raw", "label": "Raw"},
    ]
    # station, variable(s) Aggregation Interval, Start Date, End Date
    return [
        dmc.Stack(
            [
                dmc.Group(
                    [
                        dmc.Stack(
                            [
                                station_dd,
                                element_dd,
                                dmc.Group(
                                    [
                                        dmc.Stack(
                                            [
                                                dmc.Switch(
                                                    size="md",
                                                    id="dl-public",
                                                    radius="xl",
                                                    label="Show Uncommon Variables",
                                                    checked=False,
                                                    disabled=False,
                                                ),
                                                dmc.Switch(
                                                    size="md",
                                                    id="dl-rmna",
                                                    radius="xl",
                                                    label="Remove Flagged Data",
                                                    checked=False,
                                                    disabled=False,
                                                ),
                                            ],
                                        ),
                                        dmc.Stack(
                                            [
                                                dmc.Text(
                                                    "Time Aggregation",
                                                    size="sm",
                                                    weight=500,
                                                ),
                                                dmc.ChipGroup(
                                                    [
                                                        dmc.Chip(
                                                            x["label"],
                                                            value=x["value"],
                                                        )
                                                        for x in times
                                                    ],
                                                    id="dl-timeperiod",
                                                    value="daily",
                                                ),
                                            ],
                                            justify="center",
                                        ),
                                    ],
                                    position="center",
                                    grow=True,
                                ),
                                dmc.Group(
                                    [
                                        dmc.DatePicker(
                                            id="dl-start",
                                            label="Start Date",
                                            minDate=min_date,
                                            maxDate=dt.date.today(),
                                            value=min_date,
                                        ),
                                        dmc.DatePicker(
                                            id="dl-end",
                                            label="End Date",
                                            minDate=min_date,
                                            maxDate=dt.date.today(),
                                            value=dt.date.today(),
                                        ),
                                    ],
                                    position="center",
                                    grow=True,
                                ),
                                dmc.Group(
                                    [
                                        dmc.Button(
                                            "Run Request",
                                            id="run-dl-request",
                                            variant="gradient",
                                        ),
                                        dmc.Button(
                                            "Download Data",
                                            id="dl-data-button",
                                            variant="gradient",
                                        ),
                                        dmc.Alert(
                                            "Please select a station and variable first!",
                                            color="red",
                                            withCloseButton=True,
                                            variant="filled",
                                            id="dl-alert",
                                            hide=True,
                                        ),
                                    ],
                                    position="center",
                                    grow=True,
                                ),
                                dcc.Download(id="downloader-data"),
                            ],
                            align="left",
                            justify="center",
                        ),
                        dbc.Col(
                            dbc.Card(
                                html.Div(
                                    dbc.CardBody(
                                        # id="bl-content",
                                        children=dcc.Graph(
                                            id="download-map", figure=station_fig
                                        ),
                                        className="card-text",
                                    ),
                                    # style={"overflow": "scroll"},
                                )
                            ),
                        ),
                    ],
                    grow=True,
                ),
                dmc.Stack(
                    [
                        html.Div(
                            children=[
                                dcc.Store("dl-data", storage_type="memory"),
                                dmc.Stack(
                                    id="dl-plots", align="strech", justify="center"
                                ),
                            ]
                        )
                    ],
                    align="strech",
                    justify="center",
                ),
            ]
        ),
        dmc.Footer(
            height=40,
            fixed=True,
            children=[
                dmc.Text(
                    "Supported by Bureau of Land Management (RM-CESU Award L16AC00359)",
                    weight=800,
                )
            ],
            style={"backgroundColor": "#129dff"},
        ),
    ]


def build_gdd_selector():
    gdd_items = [
        ("wheat", "Wheat"),
        ("barley", "Barley"),
        ("canola", "Canola"),
        ("corn", "Corn"),
        ("sunflower", "Sunflower"),
        ("sugarbeet", "Sugarbeet"),
        ("hemp", "Hemp"),
    ]
    return [
        dmc.Center(
            dmc.Text(
                "GDD Generic Crop Type",
                size="sm",
                weight=500,
            )
        ),
        dmc.Center(
            dmc.ChipGroup(
                [dmc.Chip(v, value=k, size="xs") for k, v in gdd_items],
                id="gdd-selection",
                value="wheat",
                style={"text-align": "center"},
                # mt=10,
            )
        ),
        dmc.RangeSlider(
            id="gdd-slider",
            value=[50, 86],
            marks=[
                {"value": 30, "label": "30°F"},
                # {"value": 40, "label": "40°F"},
                {"value": 50, "label": "50°F"},
                # {"value": 60, "label": "60°F"},
                {"value": 70, "label": "70°F"},
                # {"value": 80, "label": "80°F"},
                {"value": 90, "label": "90°F"},
                # {"value": 100, "label": "100°F"},
            ],
            disabled=True,
            min=30,
            max=100,
            step=1,
            minRange=1,
            maxRange=100,
            mb=35,
        ),
    ]


def build_derived_dropdowns(
    stations,
    station=None,
):
    return dmc.Grid(
        children=[
            dmc.Col(
                dmc.Stack(
                    [
                        dmc.Select(
                            data=[
                                {"label": k, "value": v}
                                for k, v in zip(
                                    stations["long_name"], stations["station"]
                                )
                            ],
                            id="station-dropdown-derived",
                            placeholder="Select a Mesonet Station Dropdown...",
                            value=station,
                            label=html.P(["Select Station", html.Br()]),
                            searchable=True,
                            # style={"width": "150%"}
                        ),
                        dmc.Group(
                            [
                                dmc.Stack(
                                    [
                                        dmc.Text("Select Variable"),
                                        dmc.Select(
                                            data=[
                                                {
                                                    "value": "etr",
                                                    "label": "Reference ET",
                                                },
                                                {
                                                    "value": "feels_like",
                                                    "label": "Feels Like Temperature",
                                                },
                                                {
                                                    "value": "gdd",
                                                    "label": "Growing Degree Days",
                                                },
                                                {
                                                    "value": "soil_temp,soil_ec_blk",
                                                    "label": "Soil Profile Plot",
                                                },
                                                {
                                                    "value": "",
                                                    "label": "Annual Comparison Plot",
                                                },
                                                {
                                                    "value": "cci",
                                                    "label": "Livestock Risk Index",
                                                },
                                                {
                                                    "value": "swp",
                                                    "label": "Soil Water Potential",
                                                },
                                                {
                                                    "value": "percent_saturation",
                                                    "label": "Percent Soil Saturation",
                                                },
                                            ],
                                            id="derived-vars",
                                            value="gdd",
                                            searchable=True,
                                            # style={"width": 400, "marginBottom": 10},
                                        ),
                                    ]
                                ),
                                dmc.Stack(
                                    [
                                        dmc.Text(html.Br()),
                                        dmc.Anchor(
                                            dmc.Button(
                                                "Learn More",
                                                # href="/mesonet/dashboard/ag_tools/"
                                                leftIcon=DashIconify(
                                                    icon="feather:info", width=20
                                                ),
                                            ),
                                            href="https://climate.umt.edu/mesonet/dashboard/ag_tools/",
                                            id="derived-link",
                                            target="_blank",
                                        ),
                                    ]
                                ),
                            ],
                            grow=True,
                            spacing="xl",
                            position="left",
                        ),
                    ]
                ),
                span=4,
            ),
            dmc.Col(
                dmc.Stack(
                    [
                        dmc.DatePicker(
                            id="start-date-derived",
                            label="Start Date",
                            # minDate=min_date,
                            maxDate=dt.date.today(),
                            value=dt.date.today() - rd(days=365),
                        ),
                        dmc.DatePicker(
                            id="end-date-derived",
                            value=dt.date.today() + rd(days=1),
                            maxDate=dt.date.today() + rd(days=1),
                            label="End Date",
                        ),
                    ]
                ),
                span=4,
            ),
            dmc.Col(
                id="derived-gdd-panel",
                children=dmc.Stack(build_gdd_selector()),
                span=4,
            ),
            dmc.Col(
                id="derived-annual-panel",
                children=dmc.Stack([
                    dmc.Select(
                        id="annual-dropdown",
                        label="Comparison Variable",
                        placeholder="Select a Variable..."
                    )
                ]),
                span=4
            ),
            dmc.Col(
                id="derived-timeagg-panel",
                children=dmc.Stack(
                    [
                        dmc.Center(
                            [
                                dmc.Text("Time Aggregation:"),
                                dmc.ChipGroup(
                                    [
                                        dmc.Chip(v, value=k, size="xs")
                                        for k, v in [
                                            ("hourly", "Hourly"),
                                            ("daily", "Daily"),
                                        ]
                                    ],
                                    id="derived-timeagg",
                                    value="daily",
                                    style={"text-align": "center"},
                                    # mt=10,
                                ),
                            ]
                        ),
                        dmc.Center(
                            id="livestock-container",
                            children=[
                                dmc.Text("Livestock Type:"),
                                dmc.ChipGroup(
                                    [
                                        dmc.Chip(v, value=k, size="xs")
                                        for k, v in [
                                            ("adult", "Adult"),
                                            ("newborn", "Newborn"),
                                        ]
                                    ],
                                    id="livestock-type",
                                    value="adult",
                                    style={"text-align": "center"},
                                    # mt=10,
                                ),
                            ],
                        ),
                    ]
                ),
                span=4,
                style={"display": "none"},
            ),
            dmc.Col(
                id="derived-soil-panel",
                children=dmc.Stack(
                    [
                        dmc.Text("Soil Variable to Plot"),
                        dmc.ChipGroup(
                            [
                                dmc.Chip(v, value=k, size="xs")
                                for k, v in [
                                    ("soil_blk_ec", "Electrical Conductivity"),
                                    ("soil_vwc", "Volumetric Water Content"),
                                    ("soil_temp", "Temperature"),
                                    ("swp", "Soil Water Potential"),
                                    ("percent_saturation", "Percent Saturation"),
                                ]
                            ],
                            id="derived-soil-var",
                            value="soil_vwc",
                            style={"text-align": "center"},
                            # mt=10,
                        ),
                    ]
                ),
                span=4,
                style={"display": "none"},
            ),
        ],
        # position="center",
        # spacing="sm",
        grow=True,
        justify="space-around",
        align="center",
    )


def build_satellite_ts_selector():
    return (
        dbc.Col(
            [
                dbc.Checklist(
                    options=[{"label": "Percentiles", "value": 1}],
                    id="climatology-switch",
                    switch=True,
                    value=[1],
                    # className="toggle",
                ),
                dbc.Tooltip(
                    """
                Show the 5th and 95th percentile of observations for the period of record.
                """,
                    target="climatology-switch",
                ),
            ],
            xs=12,
            sm=12,
            md=2,
            lg=2,
            xl=2,
        ),
        dbc.Col(
            [
                dbc.InputGroup(
                    dbc.InputGroupText(
                        [
                            dbc.Checklist(
                                options=[
                                    {"value": "ET", "label": "ET"},
                                    {"value": "EVI", "label": "EVI"},
                                    {"value": "Fpar", "label": "FPAR"},
                                    {"value": "GPP", "label": "GPP"},
                                    {"value": "LAI", "label": "LAI"},
                                    {"value": "NDVI", "label": "NDVI"},
                                    {"value": "PET", "label": "PET"},
                                    {
                                        "label": "Rootzone Soil Moisture",
                                        "value": "sm_rootzone",
                                    },
                                    {
                                        "label": "Rootzone Soil Saturation",
                                        "value": "sm_rootzone_wetness",
                                    },
                                    {
                                        "label": "Surface Soil Moisture",
                                        "value": "sm_surface",
                                    },
                                    {
                                        "label": "Surface Soil Saturation",
                                        "value": "sm_surface_wetness",
                                    },
                                ],
                                inline=True,
                                id="sat-vars",
                                value=["ET", "GPP", "NDVI"],
                            )
                        ],
                        style={"overflow-x": "scroll"},
                    ),
                    # className="mb-3",
                    size="lg",
                )
            ],
            xs=12,
            sm=12,
            md=6,
            lg=6,
            xl=6,
        ),
    )


def build_satellite_comp_selector(sat_compare_mapper):
    return [
        dbc.Col(
            dbc.Row(
                [
                    dbc.Select(
                        options=[
                            {"label": k, "value": v}
                            for k, v in sat_compare_mapper.items()
                        ],
                        id="compare1",
                        placeholder="Select an X-Axis...",
                        className="stationSelect",
                        # style={"width": "150%"}
                    ),
                    dbc.Select(
                        options=[
                            {"label": k, "value": v}
                            for k, v in sat_compare_mapper.items()
                        ],
                        id="compare2",
                        placeholder="Select a Y-Axis...",
                        className="stationSelect",
                        # style={"width": "150%"}
                    ),
                ]
            ),
            xs=5,
            sm=5,
            md=2,
            lg=2,
            xl=2,
        ),
        dbc.Col(
            dbc.InputGroup(
                [
                    dbc.InputGroupText("Start Date"),
                    dcc.DatePickerSingle(
                        id="start-date-satellite",
                        date=dt.date.today() - rd(years=1),
                        max_date_allowed=dt.date.today(),
                        # min_date_allowed=dt.date(2022, 1, 1),
                        disabled=False,
                    ),
                ]
            ),
            xs=5,
            sm=5,
            md=3,
            lg=3,
            xl=3,
            # style={"padding": "0rem 0rem 0rem 6.5rem"},
        ),
        dbc.Col(
            dbc.InputGroup(
                [
                    dbc.InputGroupText("End Date"),
                    dcc.DatePickerSingle(
                        id="end-date-satellite",
                        date=dt.date.today(),
                        max_date_allowed=dt.date.today(),
                        # min_date_allowed=dt.date(2022, 1, 1),
                        disabled=False,
                    ),
                ]
            ),
            xs=5,
            sm=5,
            md=3,
            lg=3,
            xl=3,
            # style={"padding": "0rem 0rem 0rem 6.5rem"},
        ),
    ]


def build_satellite_dropdowns(
    stations, timeseries=True, station=None, sat_compare_mapper=None
):
    if timeseries:
        content = build_satellite_ts_selector()
    else:
        content = build_satellite_comp_selector(sat_compare_mapper)

    children = [
        dbc.Col(
            make_station_dropdowns(stations, "station-dropdown-satellite", station),
            xs=12,
            sm=12,
            md=2,
            lg=2,
            xl=2,
        ),
        dbc.Col(
            dbc.RadioItems(
                options=[
                    {"label": "Timeseries Plot", "value": "timeseries"},
                    {"label": "Comparison Plot", "value": "compare"},
                ],
                value="timeseries" if timeseries else "compare",
                id="satellite-radio",
                # inline=True,
                # style={"padding": "0rem 0rem 0rem 5rem"},
            ),
            xs=12,
            sm=12,
            md=2,
            lg=2,
            xl=2,
        ),
    ]
    children += content
    return (
        dbc.Row(
            children=children,
            align="center",
            # style={"padding": "0.75rem 0rem 0rem 0rem"},
        ),
    )


def build_derived_content(station):
    selectors = build_derived_dropdowns(station)
    return dbc.Card(
        [
            dbc.CardHeader(
                dbc.Container(selectors, fluid=True, id="derived-selectors")
            ),
            dbc.CardBody(
                html.Div(
                    [
                        dls.Bars(
                            children=[
                                dcc.Store(
                                    id="temp-derived-data", storage_type="session"
                                ),
                                dcc.Graph(id="derived-plot"),
                            ]
                        )
                    ]
                )
            ),
        ],
        color="secondary",
        outline=True,
        className="h-100",
        style={"overflow-x": "clip"},
    )


def build_satellite_content(stations):
    selectors = build_satellite_dropdowns(stations)
    return dbc.Card(
        [
            dbc.CardHeader(
                dbc.Container(selectors, fluid=True, id="satellite-selectors")
            ),
            dbc.CardBody(
                html.Div([dcc.Graph(id="satellite-plot")], id="satellite-graph")
            ),
        ],
        color="secondary",
        outline=True,
        className="h-100",
        style={"overflow-x": "clip"},
    )


def app_layout(app_ref, stations):
    stations = stations.to_json(orient="records")
    return dbc.Container(
        children=[
            dcc.Location(id="url", refresh=False),
            dcc.Store(data="", id="current-station", storage_type="memory"),
            dcc.Store(data=stations, id="mesonet-stations", storage_type="memory"),
            dcc.Store(data="", id="triggered-by", storage_type="memory"),
            build_banner(app_ref),
            dcc.Tabs(
                style={"width": "100%", "font-size": "100%", "height": "4.5vh"},
                children=[
                    dcc.Tab(
                        label="Latest Data",
                        id="station-tab",
                        value="station-tab",
                        style=dict(
                            borderLeft="1px black solid",
                            borderRight="0px black solid",
                            **TAB_STYLE,
                        ),
                        selected_style=dict(
                            borderLeft="1px black solid",
                            borderRight="0.5px black solid",
                            **SELECTED_STYLE,
                        ),
                    ),
                    dcc.Tab(
                        label="Ag Tools",
                        id="derived-tab",
                        value="derived-tab",
                        style=dict(
                            borderLeft="0.5px black solid",
                            borderRight="0.5px black solid",
                            **TAB_STYLE,
                        ),
                        selected_style=dict(
                            borderLeft="0.5px black solid",
                            borderRight="0.5px black solid",
                            **SELECTED_STYLE,
                        ),
                    ),
                    dcc.Tab(
                        label="Data Downloader",
                        id="download-tab",
                        value="download-tab",
                        style=dict(
                            borderLeft="0.5px black solid",
                            borderRight="0.5px black solid",
                            **TAB_STYLE,
                        ),
                        selected_style=dict(
                            borderLeft="0.5px black solid",
                            borderRight="0.5px black solid",
                            **SELECTED_STYLE,
                        ),
                    ),
                    dcc.Tab(
                        label="Satellite Indicators",
                        id="satellite-tab",
                        value="satellite-tab",
                        style=dict(
                            borderLeft="0px black solid",
                            borderRight="1px black solid",
                            **TAB_STYLE,
                        ),
                        selected_style=dict(
                            borderLeft="0.5px black solid",
                            borderRight="1px black solid",
                            **SELECTED_STYLE,
                        ),
                    ),
                ],
                id="main-display-tabs",
                value="station-tab",
            ),
            dbc.Row(className="h-100", id="main-content"),
            generate_modal(),
            feedback_iframe(),
            dbc.Modal(
                [
                    dbc.ModalHeader(dbc.ModalTitle("Notice")),
                    dbc.ModalBody(
                        html.P(
                            "The selected station has no current funding and we are unfortunately unable to provide data for it."
                        )
                    ),
                ],
                id="no-funding-modal",
                is_open=False,
                size="md",
                centered=True,
                scrollable=True,
            ),
            dbc.Modal(
                id="station-modal",
                is_open=False,
                size="sm",
                centered=True,
                scrollable=True,
            ),
        ],
        fluid=True,
        style={
            "height": "100%",
            "backgroundColor": "#E9ECEF",
            "padding": "0rem 1.5rem 0rem 1.5rem",
            "overflow-y": "clip",
        },
    )
