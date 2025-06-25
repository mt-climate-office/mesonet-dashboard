import dash
from dash import html, dcc
import dash_mantine_components as dmc

app = dash.Dash(__name__)

app.layout = dmc.MantineProvider(html.Div(
    [
        dcc.Store(id='selected-values-store', data=[]), # To store selected values if needed elsewhere
        html.Div(
            className='custom-multiselect-container', # Add a class for specific styling
            children=[
                dmc.MultiSelect(
                    id="my-multiselect",
                    label="Select your options",
                    placeholder="Select all you like!",
                    data=[
                        {"value": "option1", "label": "Option 1"},
                        {"value": "option2", "label": "Option 2"},
                        {"value": "option3", "label": "Option 3"},
                        {"value": "option4", "label": "Option 4"},
                    ],
                    value=[], # Initial value
                    clearable=True,
                    searchable=True,
                    w=400,
                ),
            ]
        ),
        html.Hr(),
        html.Div(id='output-selected-values'),
        dmc.Slider(
            value=69,
            classNames={"bar": "dmc-bar", "thumb": "dmc-thumb"},
        )
    ]
))

# Optional: Callback to show what's actually selected (for debugging/demonstration)
from dash.dependencies import Input, Output

@app.callback(
    Output('output-selected-values', 'children'),
    Input('my-multiselect', 'value')
)
def update_output(selected_values):
    return f"Currently selected values (internal): {selected_values}"


if __name__ == "__main__":
    app.run(debug=True)