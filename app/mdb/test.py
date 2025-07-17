import dash_ag_grid as dag
from dash import Dash, html
import pandas as pd

app = Dash()

df = pd.read_csv(
    "https://raw.githubusercontent.com/plotly/datasets/master/ag-grid/olympic-winners.csv"
)

columnDefs = [
    {"field": "athlete"},
    {"field": "age"},
    {"field": "country"},
    {"field": "year"},
    {"field": "sport"},
    {"field": "total"},
]

app.layout = html.Div(
    [
        dag.AgGrid(
            id="row-selection-checkbox-header-function",
            columnDefs=columnDefs,
            rowData=df.to_dict("records"),
            columnSize="sizeToFit",
            defaultColDef={
                "filter": True,
                "checkboxSelection": {
                    "function": 'params.column == params.columnApi.getAllDisplayedColumns()[0]'
                },
                "headerCheckboxSelection": {
                    "function": 'params.column == params.columnApi.getAllDisplayedColumns()[0]'
                }
            },
            dashGridOptions={
                "rowSelection": "multiple",
                "suppressRowClickSelection": True,
                "animateRows": False
            },
        ),
    ],
)

if __name__ == "__main__":
    app.run(debug=False)
