import dash_bootstrap_components as dbc
import dash_draggable
from dash import Dash, Input, Output, clientside_callback, html

app = Dash(__name__)

app.layout = html.Div(
    [
        dash_draggable.ResponsiveGridLayout(
            id="draggable-container",
            children=[
                html.Div(
                    "Component 1",
                    id="comp1",
                    style={"border": "1px solid black", "padding": "10px"},
                ),
                html.Div(
                    "Component 2",
                    id="comp2",
                    style={"border": "1px solid black", "padding": "10px"},
                ),
                html.Div(
                    "Component 3",
                    id="comp3",
                    style={"border": "1px solid black", "padding": "10px"},
                ),
            ],
            layouts={
                "lg": [
                    {"i": "comp1", "x": 0, "y": 0, "w": 4, "h": 2},
                    {"i": "comp2", "x": 4, "y": 0, "w": 4, "h": 2},
                    {"i": "comp3", "x": 8, "y": 0, "w": 4, "h": 2},
                ]
            },
            style={"width": "100%", "height": "100%"},
        )
    ],
    style={
        "display": "flex",
        "justifyContent": "center",
        "alignItems": "center",
        "height": "100vh",
    },
)

# Set the width/height of the grid container to 50vw/50vh for ~50% of screen area
app.layout.children[0].style.update({"width": "50vw", "height": "50vh"})

if __name__ == "__main__":
    app.run(debug=True)
