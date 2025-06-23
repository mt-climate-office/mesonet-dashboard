from dash import dcc, html, Input, Output, callback
import pandas as pd
import dash
import plotly.express as px

dash.register_page(__name__)


# Sample data for the charts
df_sales = pd.DataFrame({
    'Month': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    'Sales': [100, 120, 140, 110, 160, 180],
    'Profit': [20, 25, 30, 22, 35, 40]
})

df_users = pd.DataFrame({
    'Day': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    'Users': [500, 600, 750, 800, 900, 1200, 1100]
})

# Reports page layout
def layout():
    fig_users = px.bar(df_users, x='Day', y='Users', 
                      title='Daily User Activity')
    
    return html.Div([
        html.H1("Reports", className="text-center mb-4"),
        html.Div([
            html.Div([
                dcc.Graph(figure=fig_users)
            ], className="col-md-8"),
            html.Div([
                html.H4("Weekly Summary"),
                html.Table([
                    html.Thead([
                        html.Tr([html.Th("Day"), html.Th("Users")])
                    ]),
                    html.Tbody([
                        html.Tr([html.Td(row['Day']), html.Td(row['Users'])]) 
                        for _, row in df_users.iterrows()
                    ])
                ], className="table table-striped")
            ], className="col-md-4")
        ], className="row"),
        html.Div([
            html.H4("Data Export"),
            html.P("Download options:"),
            html.Button("Download Sales Data", className="btn btn-primary me-2"),
            html.Button("Download User Data", className="btn btn-secondary")
        ], className="container mt-4")
    ])
