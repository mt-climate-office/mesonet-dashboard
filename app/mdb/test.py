from datetime import datetime

import dash
import dash_mantine_components as dmc
from dash import html


def create_forecast_card(forecast_data):
    """Create a single forecast card from forecast data"""

    # Parse the start time to get day name
    start_time = datetime.fromisoformat(
        forecast_data["startTime"].replace("Z", "+00:00")
    )
    day_name = start_time.strftime("%A")

    # Determine if it's a day or night period
    period_name = forecast_data.get("name", "")

    return dmc.Card(
        children=[
            dmc.Group(
                [
                    # Day name and period
                    dmc.Stack(
                        [
                            dmc.Text(day_name, size="lg"),
                            dmc.Text(period_name, size="sm", c="dimmed"),
                        ]
                    ),
                    # Weather icon
                    html.Img(
                        src=forecast_data.get("icon", ""),
                        style={"width": "50px", "height": "50px"},
                    ),
                    # Temperature
                    dmc.Text(
                        f"{forecast_data.get('temperature', 'N/A')}°{forecast_data.get('temperatureUnit', 'F')}",
                        size="xl",
                    ),
                ]
            ),
            # Short forecast
            dmc.Text(
                forecast_data.get("shortForecast", ""),
                size="sm",
                style={"marginTop": "8px"},
            ),
            # Weather details
            dmc.Stack(
                [
                    dmc.Group(
                        [
                            dmc.Text("💧", size="sm"),
                            dmc.Text(
                                f"{forecast_data.get('probabilityOfPrecipitation', {}).get('value', 0)}%",
                                size="sm",
                            ),
                        ]
                    ),
                    dmc.Group(
                        [
                            dmc.Text("💨", size="sm"),
                            dmc.Text(
                                f"{forecast_data.get('windSpeed', 'N/A')} {forecast_data.get('windDirection', '')}",
                                size="sm",
                            ),
                        ]
                    ),
                ],
                style={"marginTop": "12px"},
            ),
            # Detailed forecast (expandable)
            dmc.Accordion(
                children=[
                    dmc.AccordionItem(
                        children=[
                            dmc.AccordionControl("Details"),
                            dmc.AccordionPanel(
                                dmc.Text(
                                    forecast_data.get("detailedForecast", ""), size="sm"
                                )
                            ),
                        ],
                        value="details",
                    )
                ],
                variant="separated",
                style={"marginTop": "12px"},
            ),
        ],
        withBorder=True,
        shadow="sm",
        radius="md",
        style={"marginBottom": "16px"},
    )


def create_forecast_widget(forecast_list):
    """Create the main forecast widget with up to 5 days of forecasts"""

    # Take only the first 5 forecast periods
    forecast_data = forecast_list[:5] if len(forecast_list) > 5 else forecast_list

    return dmc.Paper(
        children=[
            # Header
            dmc.Group(
                [
                    dmc.Text("5-Day Weather Forecast", size="xl"),
                    dmc.Badge("Updated", c="blue", variant="light"),
                ],
                style={"marginBottom": "20px"},
            ),
            # Forecast cards
            dmc.Stack([create_forecast_card(forecast) for forecast in forecast_data]),
        ],
        shadow="lg",
        radius="lg",
        p="xl",
        style={"maxWidth": "600px", "margin": "20px auto"},
    )


# Example usage in your Dash app
app = dash.Dash(__name__)

# Sample forecast data (replace with your actual API response)
sample_forecast_data = [
    {
        "number": 1,
        "name": "This Afternoon",
        "startTime": "2025-07-01T13:00:00-07:00",
        "endTime": "2025-07-01T18:00:00-07:00",
        "isDaytime": True,
        "temperature": 84,
        "temperatureUnit": "F",
        "temperatureTrend": "",
        "probabilityOfPrecipitation": {"unitCode": "wmoUnit:percent", "value": 6},
        "windSpeed": "7 mph",
        "windDirection": "N",
        "icon": "https://api.weather.gov/icons/land/day/sct?size=medium",
        "shortForecast": "Mostly Sunny",
        "detailedForecast": "Mostly sunny, with a high near 84. North wind around 7 mph.",
    },
    {
        "number": 2,
        "name": "Tonight",
        "startTime": "2025-07-01T18:00:00-07:00",
        "endTime": "2025-07-02T06:00:00-07:00",
        "isDaytime": False,
        "temperature": 58,
        "temperatureUnit": "F",
        "temperatureTrend": "",
        "probabilityOfPrecipitation": {"unitCode": "wmoUnit:percent", "value": 10},
        "windSpeed": "5 mph",
        "windDirection": "NW",
        "icon": "https://api.weather.gov/icons/land/night/few?size=medium",
        "shortForecast": "Mostly Clear",
        "detailedForecast": "Mostly clear, with a low around 58. Northwest wind around 5 mph.",
    },
    # Add more forecast periods as needed...
]

app.layout = dmc.MantineProvider(
    [dmc.Container([create_forecast_widget(sample_forecast_data)], size="lg")]
)

if __name__ == "__main__":
    app.run(debug=True)
