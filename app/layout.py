import datetime as dt

import dash_bootstrap_components as dbc
import dash_loading_spinners as dls
from dash import dcc, html
from dateutil.relativedelta import relativedelta as rd

TABLE_STYLING = {
    "css": [{"selector": "tr:first-child", "rule": "display: none"}],
    "style_cell": {"textAlign": "left"},
    "style_data": {"color": "black", "backgroundColor": "white"},
    "style_data_conditional": [
        {"if": {"row_index": "odd"}, "backgroundColor": "rgb(220, 220, 220)"}
    ],
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
                        
                        If you encounter any bugs, would like to request a new feature, or have a question regarding the dashboard, please:
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
                        ],
                        align="center",
                        className="g-0",
                    ),
                    style={"textDecoration": "none"},
                ),
                dbc.Col(
                    html.P(
                        "The Montana Mesonet Dashboard",
                        id="banner-title",
                        className="bannertxt",
                    )
                ),
                dbc.Col(
                    [
                        dbc.Button(
                            "GIVE FEEDBACK",
                            href="https://airtable.com/embed/shrxlaYUu6DcyK98s?",
                            size="lg",
                            n_clicks=0,
                            id="feedback-button",
                            className="me-md-2",
                            target="_blank",
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
                    style={
                        "padding": "0rem 0rem 0rem 0rem",
                        "align-items": "center",
                        "justify-content": "center",
                    },
                ),
            ],
            fluid=True,
        ),
        color="#E9ECEF",
        dark=False,
    )


def make_station_dropdowns(stations, id, station):
    return dbc.Select(
        options=[
            {"label": k, "value": v}
            for k, v in zip(stations["long_name"], stations["station"])
        ],
        id=id,
        placeholder="Select a Mesonet Station...",
        value=station,
        style={"font-size": "1.5rem"}
    )


def build_dropdowns(stations):

    return dbc.Col(
        [
            dbc.Row(
                make_station_dropdowns(stations, "station-dropdown", None),
                style={"padding": "1rem 5rem 1rem 5rem"},
                align="center",
            ),
            dbc.Row(
                dbc.InputGroup(
                    dbc.InputGroupText(
                        [
                            dbc.Checklist(
                                options=[
                                    {
                                        "value": "Precipitation",
                                        "label": "Precipitation",
                                    },
                                    {"value": "ET", "label": "Reference ET"},
                                    {"value": "Soil VWC", "label": "Soil Moisture"},
                                    {
                                        "value": "Air Temperature",
                                        "label": "Air Temperature",
                                    },
                                    {
                                        "value": "Solar Radiation",
                                        "label": "Solar Radiation",
                                    },
                                    {
                                        "value": "Soil Temperature",
                                        "label": "Soil Temperature",
                                    },
                                    {
                                        "value": "Relative Humidity",
                                        "label": "Relative Humidity",
                                    },
                                    {"value": "Wind Speed", "label": "Wind Speed"},
                                    {
                                        "value": "Atmospheric Pressure",
                                        "label": "Atmospheric Pressure",
                                    },
                                ],
                                inline=True,
                                id="select",
                                value=[
                                    "Air Temperature",
                                    "Precipitation",
                                    "Soil VWC",
                                    "Soil Temperature",
                                ],
                            )
                        ],
                        style={"overflow-x": "scroll"},
                    ),
                    className="mb-3",
                    size="lg",
                ),
                id="to-hide",
                style={"visibility": "hidden", "height": "50px"},
            ),
        ]
    )


def build_content(stations):

    return dbc.Card(
        [
            dbc.CardHeader(
                [
                    dbc.Tabs(
                        [
                            dbc.Tab(label="Current Conditions", tab_id="current"),
                            dbc.Tab(label="1-Week Summary", tab_id="plot"),
                            dbc.Tab(label="Weather Forecast", tab_id="forecast"),
                            dbc.Tab(label="Mesonet Map", tab_id="map"),
                        ],
                        id="tabs",
                        active_tab="current",
                        style={"align-items": "center", "justify-content": "center"},
                    ),
                    build_dropdowns(stations),
                ]
            ),
            dbc.CardBody(dls.Bars(html.Div(id="main-content"))),
        ],
        outline=True,
        color="secondary",
        className="h-100",
        style={"overflow": "clip"},
    )


def app_layout(app_ref, stations):

    return dbc.Container(
        [
            dcc.Location(id="url", refresh=False),
            dcc.Store("data", storage_type="session"),
            build_banner(app_ref),
            dbc.Col(
                build_content(stations),
                style={
                    "height": "100%",
                    "overflow-y": "scroll",
                },
            ),
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
        style={
            "height": "100%",
            "backgroundColor": "#E9ECEF",
            "padding": "1rem 1rem 1rem 1rem",
            "overflow-y": "clip",
        },
    )
