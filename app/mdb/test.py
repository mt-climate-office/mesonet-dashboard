import dash
from dash import dcc, html
from dash.dependencies import (
    Input,
    Output,
    State,
)

from mdb.utils.update import DashShare, update_component_state

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

tracker = DashShare(app=app, interval_trigger=("load", "n_clicks"))
app.layout = tracker.update_layout(make_layout())
tracker.register_callbacks()



@app.callback(
    Output("test1", "children"), Input("inc", "n_clicks"), State("triggered-by", "data")
)
@tracker.prevent_update
def test1(n, trig):
    return f"Clicked {n} times"


@app.callback(
    Output("test2", "children"),
    Input("inc", "n_clicks"),
)
def test2(n):
    return f"Clicked {n*2} times"


@app.callback(
    Output("test3", "children"),
    Input("inc", "n_clicks"),
)
def test3(n):
    return f"Clicked {n*3} times"


@app.callback(
    Output("save", "n_clicks"),
    Input("save", "n_clicks"),
    State("app-layout", "children"),
)
def save(n_clicks, layout):
    import json

    if n_clicks is not None and n_clicks > 0:

        layout = update_component_state(
            layout, None, test1={"children": "Surprise!!!!"}
        )

        with open("./test.json", "w") as json_file:
            json.dump(layout, json_file, indent=4)
    return n_clicks


@app.callback(
    Output("app-layout", "children"),
    Output("triggered-by", "data", allow_duplicate=True),
    Input("load", "n_clicks"),
    State("app-layout", "children"),
    prevent_initial_call=True,
)
def load_stuff(n, state):
    import json

    if n:
        with open("./test.json", "rb") as file:
            state = json.load(file)
        return state, tracker.store_value
    return state, ""


if __name__ == "__main__":
    app.run_server(debug=True)
