import datetime as dt

import dash
import dash_bootstrap_components as dbc
import dash_mantine_components as dmc
import httpx
import polars as pl
from dash import (
    Dash,
    Input,
    Output,
    State,
    _dash_renderer,
    callback,
    clientside_callback,
    dcc,
    html,
)
from dash_ag_grid import AgGrid
from dash_iconify import DashIconify

from mdb.utils.get_data import get_elements, get_stations

theme_toggle = dmc.Switch(
    offLabel=DashIconify(
        icon="radix-icons:sun", width=16, color=dmc.DEFAULT_THEME["colors"]["yellow"][6]
    ),
    onLabel=DashIconify(
        icon="radix-icons:moon",
        width=16,
        color=dmc.DEFAULT_THEME["colors"]["blue"][4],
    ),
    id="color-scheme-toggle",
    persistence=True,
    color="blue",
    size="lg",
    radius="xl",
)


def build_station_dropdown(stations):
    return dmc.Stack(
        [
            dmc.Text("Weather Station", fw=600, size="lg", c="dimmed"),
            dmc.Select(
                id="station-select",
                data=[
                    {
                        "value": str(station["station"]),
                        "label": f"{station['name']} ({station['sub_network']})",
                    }
                    for station in stations.to_dicts()
                ],
                searchable=True,
                clearable=True,
                placeholder="Choose your weather station...",
                size="lg",
                radius="md",
                leftSection=DashIconify(icon="mdi:map-marker", width=20),
                comboboxProps={
                    "shadow": "md",
                    "transitionProps": {"transition": "pop", "duration": 200},
                },
            ),
        ],
        gap="xs",
    )


def build_date_range():
    return dmc.Stack(
        [
            dmc.Text("Date Range", fw=600, size="lg", c="dimmed"),
            dmc.DatePickerInput(
                id="date-range",
                placeholder="Select your date range...",
                size="xl",
                radius="md",
                value=[
                    dt.datetime.now().date() - dt.timedelta(days=14),
                    dt.datetime.now().date(),
                ],
                clearable=True,
                type="range",
                withAsterisk=True,
                leftSection=DashIconify(icon="mdi:calendar-range", width=20),
                popoverProps={"shadow": "md", "radius": "md"},
                styles={
                    "input": {"fontFamily": "Arial, sans-serif", "fontSize": "9px"},
                },
                numberOfColumns=2,
            ),
            dmc.Button(
                "Select Period of Record",
                id="por-button",
                variant="light",
                color="indigo",
                size="sm",
                radius="md",
                leftSection=DashIconify(icon="mdi:calendar-clock", width=16),
                fullWidth=True,
            ),
        ],
        gap="xs",
    )


def build_timescale_tabs():
    return dmc.Stack(
        [
            dmc.Text("Data Resolution", fw=600, size="lg", c="dimmed"),
            dmc.SegmentedControl(
                id="timescale-tabs",
                value="hourly",
                data=[
                    {"value": "raw", "label": "Raw Data"},
                    {"value": "hourly", "label": "Hourly"},
                    {"value": "daily", "label": "Daily"},
                    {"value": "monthly", "label": "Monthly"},
                ],
                size="md",
                radius="md",
                color="blue",
                fullWidth=True,
            ),
        ],
        gap="xs",
    )


def build_feedback_modal():
    return dmc.Modal(
        title="Provide Feedback to Improve Our Dashboard",
        id="feedback-modal",
        opened=False,
        size="xl",
        children=[
            html.Div(
                id="fillout-popup",
                **{
                    "data-fillout-id": "o72SZtDEonus",
                    "data-fillout-embed-type": "popup",
                    "data-fillout-dynamic-resize": True,
                    "data-fillout-inherit-parameters": True,
                    "data-fillout-popup-size": "medium",
                },
            )
        ],
        styles={"content": {"maxHeight": "none", "height": "100%"}},
    )


def build_learn_more_modal():
    return html.Div(
        dmc.Modal(
            [
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
            ],
            id="modal",
            opened=False,
            size="xl",
            centered=True,
        )
    )


def build_advanced_options():
    return dmc.Stack(
        [
            dmc.Button(
                "Advanced Options",
                id="advanced-options-toggle",
                variant="subtle",
                color="gray",
                size="sm",
                radius="md",
                leftSection=DashIconify(icon="mdi:cog", width=16),
                rightSection=DashIconify(icon="mdi:chevron-down", width=16),
                fullWidth=True,
            ),
            dmc.Collapse(
                dmc.Stack(
                    [
                        dmc.Switch(
                            label="GridMET Normals",
                            id="gridmet-normals-switch",
                            color="blue",
                            size="sm",
                        ),
                        dmc.Switch(
                            label="Show Uncommon Variables",
                            id="uncommon-variables-switch",
                            color="blue",
                            size="sm",
                        ),
                        dmc.Switch(
                            label="Remove Flagged Data",
                            id="remove-flagged-switch",
                            color="blue",
                            size="sm",
                        ),
                    ],
                    gap="sm",
                    p="md",
                    style={
                        "backgroundColor": "var(--mantine-color-gray-0)",
                        "border-radius": "8px",
                    },
                ),
                id="advanced-options-collapse",
                opened=False,
            ),
        ],
        gap="xs",
    )


def build_element_multiselect(elements, public=True):
    df = (
        elements.select("element", "description_short", "public")
        .filter(pl.col("public") == public)
        .with_columns(
            [
                pl.col("element").str.replace(r"(_\d+)$", ""),  # Remove trailing _XXXX
                pl.col("description_short")
                .str.split("@")
                .list.get(0)
                .str.strip_suffix(" "),
            ]
        )
        .unique(subset=["element", "description_short"])
        .sort("description_short")
    )

    return dmc.Stack(
        [
            dmc.Group(
                [
                    dmc.Text("Weather Variables", fw=600, size="lg", c="dimmed"),
                    dmc.Anchor(
                        DashIconify(icon="mdi:information-outline", width=18),
                        href="https://climate.umt.edu/mesonet/variables/",
                        target="_blank",
                        style={"marginLeft": "0.5em"},
                    ),
                ],
                gap="xs",
                align="center",
            ),
            dmc.MultiSelect(
                id="element-multiselect",
                data=[
                    {"value": row["element"], "label": row["description_short"]}
                    for row in df.to_dicts()
                ],
                # TODO: Use this class to hide selections. Then use dash-ag-grid to
                # make  the order draggable.
                # className='custom-multiselect-container',
                searchable=True,
                clearable=True,
                placeholder="Select variables...",
                size="lg",
                radius="md",
                hidePickedOptions=False,
                leftSection=DashIconify(icon="mdi:chart-line", width=20),
                comboboxProps={
                    "shadow": "md",
                    "transitionProps": {"transition": "pop", "duration": 200},
                },
                value=["air_temp", "ppt", "soil_vwc", "soil_temp"],
            ),
        ],
        gap="xs",
    )


def build_control_panel(stations, elements):
    return dmc.Stack(
        [
            dmc.Paper(
                [
                    dmc.Group(
                        [
                            DashIconify(icon="mdi:tune", width=20, color="blue"),
                            dmc.Text("Control Panel", fw=700, size="lg", c="blue"),
                        ],
                        gap="xs",
                    ),
                ],
                p="xs",
                radius="md",
                withBorder=True,
                shadow="sm",
                mb="lg",
            ),
            build_station_dropdown(stations=stations),
            build_date_range(),
            build_element_multiselect(elements=elements),
            build_timescale_tabs(),
            build_advanced_options(),
            dmc.Divider(
                variant="dashed", style={"marginTop": "2rem", "marginBottom": "1rem"}
            ),
            dmc.Stack(
                [
                    dmc.Button(
                        "Download Data",
                        leftSection=DashIconify(icon="mdi:download", width=16),
                        variant="light",
                        color="green",
                        size="sm",
                        radius="md",
                    ),
                    dmc.Button(
                        "Reset Filters",
                        leftSection=DashIconify(icon="mdi:refresh", width=16),
                        variant="subtle",
                        color="gray",
                        size="sm",
                        radius="md",
                    ),
                ],
                justify="space-between",
            ),
        ],
        gap="lg",
    )


def build_main_graph_card():
    return dmc.Paper(
        [
            dmc.Stack(
                [
                    dmc.Group(
                        [
                            DashIconify(
                                icon="mdi:chart-timeline-variant",
                                width=28,
                                color="blue",
                            ),
                            dmc.Title(
                                "Weather Data Visualization",
                                order=2,
                                c="blue",
                            ),
                        ],
                        gap="sm",
                    ),
                    dmc.Text(
                        "Explore real-time and historical weather data from Montana's comprehensive weather station network. "
                        "Select a station, choose your variables of interest, and visualize the data across different time scales.",
                        size="md",
                        c="dimmed",
                    ),
                    dmc.Divider(variant="dashed"),
                    dmc.Text(
                        "Interactive charts and data tables will appear here once you make your selections.",
                        ta="center",
                        size="lg",
                        c="dimmed",
                        py="xl",
                        # id="main-graph-id"
                    ),
                ],
                gap="md",
                style={"height": "100%"},
            ),
        ],
        p="xl",
        radius="lg",
        withBorder=True,
        shadow="sm",
        style={"height": "100%"},
    )


def build_upper_info_card():
    return dmc.Paper(
        [
            dmc.Stack(
                [
                    dmc.Group(
                        [
                            DashIconify(
                                icon="mdi:information",
                                width=24,
                                color="green",
                            ),
                            dmc.Title(
                                "Station Info",
                                order=3,
                                c="green",
                            ),
                        ],
                        gap="sm",
                    ),
                    dmc.Text(
                        "Station details, location coordinates, elevation, and current status will be displayed here when a station is selected.",
                        size="sm",
                        c="dimmed",
                    ),
                    dmc.Badge(
                        "No Station Selected",
                        color="gray",
                        variant="light",
                    ),
                ],
                gap="sm",
            ),
        ],
        p="lg",
        radius="lg",
        withBorder=True,
        shadow="sm",
    )


def build_lower_info_card():
    return dmc.Paper(
        [
            dmc.Stack(
                [
                    dmc.Group(
                        [
                            DashIconify(
                                icon="mdi:download",
                                width=24,
                                color="orange",
                            ),
                            dmc.Title(
                                "Data Export",
                                order=3,
                                c="orange",
                            ),
                        ],
                        gap="sm",
                    ),
                    dmc.Text(
                        "Download options for CSV, JSON, and other formats. Export filtered data based on your current selections.",
                        size="sm",
                        c="dimmed",
                    ),
                    dmc.Group(
                        [
                            dmc.Button(
                                "CSV",
                                size="xs",
                                variant="light",
                                color="orange",
                            ),
                            dmc.Button(
                                "JSON",
                                size="xs",
                                variant="light",
                                color="orange",
                            ),
                            dmc.Button(
                                "Excel",
                                size="xs",
                                variant="light",
                                color="orange",
                            ),
                        ],
                        gap="xs",
                    ),
                ],
                gap="sm",
            ),
        ],
        p="lg",
        radius="lg",
        withBorder=True,
        shadow="sm",
    )


def build_latest_data_tab_content():
    return dmc.Grid(
        [
            dmc.GridCol(
                build_main_graph_card(),
                span={"base": 12, "md": 8},
            ),
            dmc.GridCol(
                dmc.Stack(
                    [
                        build_upper_info_card(),
                        build_lower_info_card(),
                    ],
                    gap="md",
                ),
                span={"base": 12, "md": 4},
            ),
        ],
        grow=True,
        gutter="md",
        style={"height": "100%"},
        justify="space-between",
        align="stretch",
    )


def build_app_header():
    return dmc.Group(
        [
            dmc.Group(
                [
                    dmc.Burger(
                        id="burger",
                        size="md",
                        hiddenFrom="sm",
                        opened=True,
                    ),
                    dmc.Anchor(
                        dmc.Paper(
                            dmc.Image(
                                src=dash.get_asset_url("MCO_logo.svg"),
                                alt="MCO Logo",
                                h=70,
                                radius="md",
                            ),
                            withBorder=False,
                            shadow="xs",
                            radius="md",
                            p="sm",
                            style={"backgroundColor": "white"},
                        ),
                        href="https://climate.umt.edu",
                        target="_blank",
                    ),
                ]
            ),
            dmc.Title("The Montana Mesonet Dashboard", order="1", c="dark"),
            dmc.Group(
                [
                    dmc.Group(
                        [
                            dmc.Anchor(
                                dmc.Button(
                                    "Give Feedback",
                                    id="feedback-button",
                                    variant="subtle",
                                    color="gray",
                                    size="sm",
                                    leftSection=DashIconify(
                                        icon="mdi:comment-text", width=16
                                    ),
                                ),
                                href="https://forms.fillout.com/t/o72SZtDEonus",
                                target="_blank",
                                underline=False,
                                style={"textDecoration": "none"},
                            ),
                            dmc.Button(
                                "Learn More",
                                id="help-button",
                                variant="subtle",
                                color="gray",
                                size="sm",
                                leftSection=DashIconify(icon="mdi:book-open", width=16),
                            ),
                            dmc.Anchor(
                                dmc.Button(
                                    "GitHub",
                                    variant="subtle",
                                    color="gray",
                                    size="sm",
                                    leftSection=DashIconify(
                                        icon="mdi:github", width=16
                                    ),
                                ),
                                href="https://github.com/mt-climate-office",
                                target="_blank",
                            ),
                            dmc.Anchor(
                                dmc.Button(
                                    "Email",
                                    variant="subtle",
                                    color="gray",
                                    size="sm",
                                    leftSection=DashIconify(icon="mdi:email", width=16),
                                ),
                                href="mailto:state.climatologist@umontana.edu",
                            ),
                        ],
                        gap="xs",
                    ),
                    dmc.Group(
                        [
                            dmc.Text("Theme", size="sm", c="dimmed", fw=500),
                            theme_toggle,
                        ],
                        gap="xs",
                    ),
                ],
                gap="md",
            ),
        ],
        justify="space-between",
        style={"flex": 1},
        h="100%",
        px="md",
    )


def build_layout():
    stations = get_stations()
    elements = get_elements()

    layout = dmc.AppShell(
        [
            dcc.Store(id="elements-store", data=elements.to_dicts()),
            dcc.Store(id="stations-store", data=stations.to_dicts()),
            dcc.Store(id="latest-store"),
            dcc.Store(id="agtools-store"),
            dcc.Store(id="satellite-store"),
            dcc.Location(id="url"),
            build_learn_more_modal(),
            dmc.AppShellHeader(
                build_app_header(),
            ),
            dmc.AppShellNavbar(
                id="navbar",
                children=[
                    build_control_panel(
                        stations=stations,
                        elements=elements,
                    )
                ],
                p="xl",
                style={"overflow-y": "scroll"}
            ),
            dmc.AppShellMain(
                dmc.Tabs(
                    [
                        dmc.TabsList(
                            [
                                dmc.TabsTab(
                                    "Latest Data",
                                    value="latest-data-tab",
                                    leftSection=DashIconify(
                                        icon="mdi:chart-timeline-variant", width=18
                                    ),
                                ),
                                dmc.TabsTab(
                                    "Ag Tools",
                                    value="ag-tools-tab",
                                    leftSection=DashIconify(
                                        icon="mdi:sprout", width=18
                                    ),
                                ),
                                dmc.TabsTab(
                                    "Satellite Indicators",
                                    value="satellite-indicators-tab",
                                    leftSection=DashIconify(
                                        icon="mdi:satellite-variant", width=18
                                    ),
                                ),
                            ],
                            style={"background-color": "#FFFFFF"},
                            grow=True,
                        ),
                        dmc.Container(
                            [dmc.Space(h=30), build_latest_data_tab_content()],
                            fluid=True,
                        ),
                    ],
                    value="latest-data-tab",
                    variant="default",
                    radius="xs",
                    autoContrast=False,
                    id='page-tabs'
                ),
                w="100%",
                style={"height": "100vh", "background-color": "#F5F5F5", "overflow-y": "scroll"},
            ),
        ],
        header={"height": 120},
        padding="md",
        navbar={
            "width": 500,
            "breakpoint": "sm",
            "collapsed": {"mobile": True},
        },
        id="appshell",
    )

    return dmc.MantineProvider(
        layout,
        theme={
            "primaryColor": "blue",
            "fontFamily": "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            "headings": {
                "fontFamily": "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            },
            "radius": {"md": "8px", "lg": "12px"},
        },
    )
