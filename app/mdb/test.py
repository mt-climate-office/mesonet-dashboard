import dash_ag_grid as dag
from dash import Dash, html, dcc, Input, Output, callback
import pandas as pd

app = Dash()

df = pd.read_csv(
    "https://raw.githubusercontent.com/plotly/datasets/master/ag-grid/olympic-winners.csv"
)

columnDefs = [
    {"field": "athlete", "rowDrag": True, "checkboxSelection": True},
]

app.layout = html.Div(
    [
        dag.AgGrid(
            id="row-dragging-managed-dragging-options",
            rowData=df.to_dict("records"),
            columnDefs=columnDefs,
            defaultColDef={
                "filter": True,
                "headerCheckboxSelection": True
            },
            columnSize="sizeToFit",
            dashGridOptions={
                "rowDragManaged": True,
                "rowSelection": "multiple",
                "suppressRowClickSelection": False,
                "animateRows": True,
                "suppressMoveWhenRowDragging": False,
                "rowDragMultiRow": False,
            },
        ),
        html.Div(id="div", children="data"),
    ],
)


@callback(
    Output("div", "children"),
    Input("row-dragging-managed-dragging-options", "virtualRowData"),
    Input("row-dragging-managed-dragging-options", "selectedRows")
)
def update_row_order(rows, checks):
    out = [x["athlete"] for x in rows]
    print(checks)
    return str(out[:5])


if __name__ == "__main__":
    app.run(debug=True)
