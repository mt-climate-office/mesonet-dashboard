import dash
from dash import html
from dash.dependencies import (
    Input,
    Output,
)

from mdb.utils.update import FileShare

app = dash.Dash(__name__)


def make_layout():
    return html.Div(
        children=[
            html.Button("Save", "save"),
            html.Button("Load", "load"),
            html.Button("Increment", "inc", n_clicks=0),
            html.P("No clicks", "test1"),
            html.P("No clicks", "test2"),
            html.Div([html.Div([html.P("Nested", "test3")])]),
        ],
    )


tracker = FileShare(
    app=app,
    load_input=("load", "n_clicks"),
    save_input=("save", "n_clicks"),
    save_output=("save", "n_clicks"),
)
app.layout = tracker.update_layout(make_layout())
tracker.register_callbacks()


@app.callback(Output("test1", "children"), Input("inc", "n_clicks"))
@tracker.pause_update
def test1(n):
    return f"Clicked {n} times"


@app.callback(
    Output("test2", "children"),
    Input("inc", "n_clicks"),
)
def test2(n):
    return f"Clicked {n * 2} times"


@app.callback(
    Output("test3", "children"),
    Input("inc", "n_clicks"),
)
def test3(n):
    return f"Clicked {n * 3} times"


if __name__ == "__main__":
    app.run_server(debug=True)
