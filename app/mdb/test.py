import dash_mantine_components as dmc
from dash import Output, Input, html, callback
import dash

app = dash.Dash(__name__)


app.layout = dmc.MantineProvider(html.Div(
    [
        dmc.MultiSelect(
            label="Select your favorite libraries",
            placeholder="Select all you like!",
            id="framework-multi-select",
            value=None,
            data=[
                {"value": "pd", "label": "Pandas"},
                {"value": "np", "label": "NumPy"},
                {"value": "tf", "label": "TensorFlow"},
                {"value": "torch", "label": "PyTorch"},
            ],
            w=400,
            mb=10,
        ),
        dmc.Text(id="multi-selected-value"),
    ]
))

@callback(
    Output("multi-selected-value", "children"), Input("framework-multi-select", "value")
)
def select_value(value):
    if value is None:
        return "nothing selected"
    return ", ".join(value)

app.run(debug=True)