import datetime as dt
from functools import lru_cache

import dash
import dash_bootstrap_components as dbc
import dash_ag_grid as dag
import dash_leaflet as dl
import dash_leaflet.express as dlx
import dash_mantine_components as dmc
import httpx
import polars as pl
import pytz
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
from dash_extensions.javascript import arrow_function
from dash_iconify import DashIconify

from mdb.utils.get_data import get_elements, get_photo_config, get_stations

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
                    # {"value": "monthly", "label": "Monthly"},
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
            dmc.Badge(
                "Advanced Options",
                variant="subtle",
                color="gray",
                size="lg",
                leftSection=DashIconify(icon="mdi:cog", width=16),
            ),
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
            # dmc.MultiSelect(
            #     id="element-multiselect",
            #     data=[
            #         {"value": row["element"], "label": row["description_short"]}
            #         for row in df.to_dicts()
            #     ],
            #     # TODO: Use this class to hide selections. Then use dash-ag-grid to
            #     # make  the order draggable.
            #     # className='custom-multiselect-container',
            #     searchable=True,
            #     clearable=True,
            #     placeholder="Select variables...",
            #     size="lg",
            #     radius="md",
            #     hidePickedOptions=False,
            #     leftSection=DashIconify(icon="mdi:chart-line", width=20),
            #     comboboxProps={
            #         "shadow": "md",
            #         "transitionProps": {"transition": "pop", "duration": 200},
            #     },
            #     value=["air_temp", "ppt", "soil_vwc", "soil_temp"],
            # ),
        ],
        gap="xs",
    )


def build_control_panel(stations, elements):
    return dmc.Stack(
        [
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
                        "Explore real-time and historical weather data from the Montana Mesonet station network."
                        "Select a station, choose your variables of interest, and visualize the data across different time scales.",
                        size="md",
                        c="dimmed",
                    ),
                    dmc.Divider(variant="dashed"),
                    dmc.Text(
                        "Interactive charts will appear here once you make your selections.",
                        ta="center",
                        size="lg",
                        c="dimmed",
                        py="xl",
                        # id="main-graph-id"
                    ),
                ],
                id="main-chart-panel",
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
            dmc.Tabs(
                [
                    dmc.TabsList(
                        children=[
                            dmc.TabsTab(
                                "Wind Rose",
                                value="wind-rose-tab",
                                leftSection=DashIconify(
                                    icon="mdi:weather-windy", width=18, color="blue"
                                ),
                            ),
                            dmc.TabsTab(
                                "Weather Forecast",
                                value="forecast-tab",
                                leftSection=DashIconify(
                                    icon="mdi:weather-partly-cloudy",
                                    width=18,
                                    color="blue",
                                ),
                            ),
                            dmc.Tooltip(
                                dmc.TabsTab(
                                    "Photos",
                                    value="photos-tab",
                                    leftSection=DashIconify(
                                        icon="mdi:camera", width=18, color="blue"
                                    ),
                                    id="photo-tab",
                                ),
                                label="Note: Photos are only available for HydroMet stations",
                                color="#ff6b6b",
                                radius="sm",
                                position="top",
                                withArrow=True,
                            ),
                        ],
                        style={"background-color": "#FFFFFF"},
                        grow=True,
                    ),
                    dmc.TabsPanel(
                        dmc.ScrollArea(
                            "wind rose",
                            h=300,  # Fixed height
                            type="scroll",
                            scrollbarSize=8,
                        ),
                        value="wind-rose-tab",
                        id="wind-rose-panel",
                    ),
                    dmc.TabsPanel(
                        dmc.ScrollArea(
                            dmc.Box(
                                [
                                    dmc.Space(h=10),
                                    dmc.Group(
                                        [
                                            dmc.ChipGroup(
                                                [
                                                    dmc.Chip("North", value="N"),
                                                    dmc.Chip("South", value="S"),
                                                ],
                                                multiple=False,
                                                value="N",
                                                id="photo-chipgroup",
                                            ),
                                            dmc.Select(
                                                id="photo-datetimes",
                                                data=[
                                                    {
                                                        "value": dt.date.today(),
                                                        "label": dt.date.today(),
                                                    }
                                                ],
                                            ),
                                        ],
                                        justify="center",
                                    ),
                                    dmc.Space(h=10),
                                    dmc.Container(id="photo-container"),
                                ]
                            ),
                            h=300,  # Fixed height
                            type="scroll",
                            scrollbarSize=8,
                        ),
                        value="photos-tab",
                    ),
                    dmc.TabsPanel(
                        dmc.ScrollArea(
                            dmc.Container(
                                [
                                    dmc.Space(h=10),
                                    dmc.Paper(
                                        children=[
                                            "Please select a station to view its forecast"
                                        ],
                                        p="xs",
                                        radius="md",
                                        withBorder=True,
                                        shadow="sm",
                                        mb="lg",
                                        id="forecast-tab-content",
                                    ),
                                ]
                            ),
                            h=300,  # Fixed height
                            type="scroll",
                            scrollbarSize=8,
                        ),
                        value="forecast-tab",
                    ),
                ],
                value="forecast-tab",
                variant="default",
                radius="xs",
                autoContrast=False,
                id="upper-right-tabs",
            )
        ],
        p="lg",
        radius="lg",
        withBorder=True,
        shadow="sm",
        h=400,  # Fixed height for the entire card
    )


def build_lower_info_card(stations):
    return dmc.Paper(
        [
            dmc.Tabs(
                [
                    dmc.TabsList(
                        children=[
                            dmc.TabsTab(
                                "Locator Map",
                                value="locator-map-tab",
                                leftSection=DashIconify(
                                    icon="mdi:map-marker-radius", width=18, color="blue"
                                ),
                            ),
                            dmc.TabsTab(
                                "Station Metadata",
                                value="station-metadata-tab",
                                leftSection=DashIconify(
                                    icon="mdi:database", width=18, color="blue"
                                ),
                            ),
                            dmc.TabsTab(
                                "Current Conditions",
                                value="current-conditions-tab",
                                leftSection=DashIconify(
                                    icon="mdi:weather-sunny", width=18, color="blue"
                                ),
                            ),
                        ],
                        style={"background-color": "#FFFFFF"},
                        grow=True,
                    ),
                    dmc.TabsPanel(
                        dmc.ScrollArea(
                            build_station_map(stations),
                            h=300,  # Fixed height
                            type="scroll",
                            scrollbarSize=8,
                        ),
                        value="locator-map-tab",
                    ),
                    dmc.TabsPanel(
                        dmc.ScrollArea(
                            dmc.Container(
                                [
                                    dmc.Space(h=10),
                                    dmc.Paper(
                                        children=[
                                            "Please select a station to view its metadata"
                                        ],
                                        p="xs",
                                        radius="md",
                                        withBorder=True,
                                        shadow="sm",
                                        mb="lg",
                                        id="station-metadata-content",
                                    ),
                                ]
                            ),
                            h=300,  # Fixed height
                            type="scroll",
                            scrollbarSize=8,
                        ),
                        value="station-metadata-tab",
                    ),
                    dmc.TabsPanel(
                        dmc.ScrollArea(
                            dmc.Container(
                                [
                                    dmc.Space(h=10),
                                    dmc.Paper(
                                        children=[
                                            "Please select a station to view latest data"
                                        ],
                                        p="xs",
                                        radius="md",
                                        withBorder=True,
                                        shadow="sm",
                                        mb="lg",
                                        id="station-latest-content",
                                    ),
                                ]
                            ),
                            h=300,  # Fixed height
                            type="scroll",
                            scrollbarSize=8,
                        ),
                        value="current-conditions-tab",
                    ),
                ],
                value="locator-map-tab",
                variant="default",
                radius="xs",
                autoContrast=False,
                id="bottom-right-tabs",
            )
        ],
        p="lg",
        radius="lg",
        withBorder=True,
        shadow="sm",
        h=400,  # Fixed height for the entire card
    )


def build_latest_data_tab_content(stations):
    return dmc.ScrollArea(
        dmc.Grid(
            [
                dmc.GridCol(
                    build_main_graph_card(),
                    span={"base": 12, "md": 8},
                ),
                dmc.GridCol(
                    dmc.Stack(
                        [
                            build_upper_info_card(),
                            build_lower_info_card(stations),
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
        ),
        type="scroll",
        scrollbarSize=10,
        scrollHideDelay=1000,
        offsetScrollbars=True,
        h="calc(100vh - 200px)",  # Adjust based on your header/tab heights
    )


def build_app_header():
    print(dash.get_asset_url("MCO_logo.svg"))
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


classes = [0, 10, 20, 50, 100, 200, 500, 1000]
colorscale = [
    "#FFEDA0",
    "#FED976",
    "#FEB24C",
    "#FD8D3C",
    "#FC4E2A",
    "#E31A1C",
    "#BD0026",
    "#800026",
]
style = dict(weight=2, opacity=1, color="white", dashArray="3", fillOpacity=0.7)


def build_station_map(stations: pl.DataFrame) -> dmc.Container:
    stations = stations.rename({"latitude": "lat", "longitude": "lon"})
    stations = stations.select(
        "station", "name", "lat", "lon", "sub_network", "elevation"
    )
    print(dash.get_asset_url("us-states.json"))
    return dmc.Container(
        [
            dmc.Space(h=10),
            dmc.Paper(
                [
                    dl.Map(
                        [
                            dl.TileLayer(),
                            dl.GeoJSON(
                                url="/home/cbrust/git/mesonet-dashboard/app/mdb/assets/us-states.json",
                                zoomToBounds=True,  # when true, zooms to bounds when data changes (e.g. on load)
                                zoomToBoundsOnClick=True,  # when true, zooms to bounds of feature (e.g. polygon) on click
                                hoverStyle=arrow_function(
                                    dict(weight=5, color="#666", dashArray="")
                                ),  # style applied on hover
                                hideout=dict(
                                    colorscale=colorscale,
                                    classes=classes,
                                    style=style,
                                    colorProp="density",
                                ),
                            ),
                            dl.GeoJSON(
                                data=dlx.dicts_to_geojson(stations.to_dicts()),
                                cluster=True,
                                zoomToBoundsOnClick=True,
                            ),
                        ],
                        center=(46.65, -109.75),
                        zoom=5,
                        style={"height": "40vh"},
                    ),
                ],
                p="xs",
                radius="md",
                withBorder=True,
                shadow="sm",
                mb="lg",
            ),
        ]
    )


def create_forecast_card(forecast_data):
    """Create a single forecast card from forecast data"""

    # Parse the start time to get day name
    start_time = dt.datetime.fromisoformat(
        forecast_data["startTime"].replace("Z", "+00:00")
    )
    day_name = start_time.strftime("%A")

    # Determine if it's a day or night period
    period_name = forecast_data.get("name", "")

    return dmc.Card(
        children=[
            dmc.Stack(
                [
                    dmc.Group(
                        [
                            dmc.Stack(
                                [
                                    dmc.Text(day_name, size="lg"),
                                    dmc.Text(period_name, size="md", c="dimmed"),
                                ]
                            ),
                            html.Img(
                                src=forecast_data.get("icon", ""),
                                style={"width": "50px", "height": "50px"},
                            ),
                            dmc.Text(
                                f"{forecast_data.get('temperature', 'N/A')}°{forecast_data.get('temperatureUnit', 'F')}",
                                size="xl",
                            ),
                            dmc.Stack(
                                [
                                    dmc.Group(
                                        [
                                            dmc.Text(
                                                "Chance of Rain 💧",
                                                size="lg",
                                                c="dimmed",
                                            ),
                                            dmc.Text(
                                                f"{forecast_data.get('probabilityOfPrecipitation', {}).get('value', 0)}%",
                                                size="lg",
                                            ),
                                        ]
                                    ),
                                    dmc.Group(
                                        [
                                            dmc.Text(
                                                "Wind Speed 💨", size="lg", c="dimmed"
                                            ),
                                            dmc.Text(
                                                f"{forecast_data.get('windSpeed', 'N/A')} {forecast_data.get('windDirection', '')}",
                                                size="lg",
                                            ),
                                        ]
                                    ),
                                ],
                            ),
                        ]
                    ),
                    dmc.Text(
                        f"Forecast Description: {forecast_data.get('shortForecast', '')}",
                        size="lg",
                    ),
                    dmc.Accordion(
                        children=[
                            dmc.AccordionItem(
                                children=[
                                    dmc.AccordionControl("Details"),
                                    dmc.AccordionPanel(
                                        dmc.Text(
                                            forecast_data.get("detailedForecast", ""),
                                            size="lg",
                                        )
                                    ),
                                ],
                                value="details",
                            )
                        ],
                        variant="separated",
                    ),
                ]
            )
        ],
        withBorder=True,
        shadow="sm",
        radius="md",
    )


def create_forecast_widget(forecast):
    """Create the main forecast widget with up to 5 days of forecasts"""
    forecast_list = forecast["periods"]
    forecast_data = forecast_list[:5] if len(forecast_list) > 5 else forecast_list
    # Convert generatedAt to America/Denver time
    utc_dt = dt.datetime.fromisoformat(forecast["generatedAt"].replace("Z", "+00:00"))
    local_tz = pytz.timezone("America/Denver")
    local_t = str(utc_dt.astimezone(local_tz))
    return [
        dcc.Loading(
            # TODO: Figure this loading out.
            dmc.ScrollArea(
                [
                    dmc.Group(
                        [
                            dmc.Text("5-Day NOAA Weather Forecast", size="xl"),
                            dmc.Badge(
                                f"Updated at {local_t}",
                                c="blue",
                                variant="light",
                                size="lg",
                            ),
                        ],
                        style={"marginBottom": "20px"},
                    ),
                    dmc.Stack(
                        [create_forecast_card(forecast) for forecast in forecast_data]
                    ),
                ],
                type="scroll",
                scrollbarSize=10,
                scrollHideDelay=1000,
                offsetScrollbars=True,
                h=400,
            ),
            custom_spinner=dmc.Skeleton(visible=True, h="100%"),
        )
    ]


@lru_cache(maxsize=1)
def build_layout() -> dmc.AppShell:
    print("api calls")
    stations = get_stations()
    elements = get_elements()
    photos = get_photo_config()

    layout = dmc.AppShell(
        [
            dcc.Store(id="elements-store", data=elements.to_dicts()),
            dcc.Store(id="stations-store", data=stations.to_dicts()),
            dcc.Store(id="photo-store", data=photos.to_dicts()),
            dcc.Store(id="observations-store"),
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
                style={"overflow-y": "scroll"},
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
                        dmc.TabsPanel(
                            build_latest_data_tab_content(stations),
                            value="latest-data-tab",
                        ),
                        # Add your other tab panels here with ScrollArea if needed
                        dmc.TabsPanel(
                            dmc.ScrollArea(
                                dmc.Container(
                                    [
                                        dmc.Space(h=30),
                                        dmc.Text("Ag Tools content goes here"),
                                    ],
                                    fluid=True,
                                ),
                                h="calc(100vh - 200px)",
                                type="scroll",
                                scrollbarSize=10,
                            ),
                            value="ag-tools-tab",
                        ),
                        dmc.TabsPanel(
                            dmc.ScrollArea(
                                dmc.Container(
                                    [
                                        dmc.Space(h=30),
                                        dmc.Text(
                                            "Satellite Indicators content goes here"
                                        ),
                                    ],
                                    fluid=True,
                                ),
                                h="calc(100vh - 200px)",
                                type="scroll",
                                scrollbarSize=10,
                            ),
                            value="satellite-indicators-tab",
                        ),
                    ],
                    value="latest-data-tab",
                    variant="default",
                    radius="xs",
                    autoContrast=False,
                    id="page-tabs",
                ),
                w="100%",
                style={
                    "height": "100vh",
                    "background-color": "#F5F5F5",
                    "overflow": "hidden",  # Prevent main container from scrolling
                },
            ),
        ],
        header={"height": 100},
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
