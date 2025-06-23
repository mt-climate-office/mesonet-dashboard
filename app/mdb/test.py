from ast import literal_eval

import dash
from dash import dcc, html, Input, Output, State, callback, ctx
from dataclasses import dataclass
from urllib.parse import parse_qs, urlencode
from typing import List, Tuple, Any

@dataclass
class Component:
    id: str
    prop: str

@dataclass
class ComponentSync:
    url: str | Component
    components: List[Tuple[str, str]] | List[Component]

    def __post_init__(self):
        if isinstance(self.components[0], tuple):
            self.components = [Component(comp_id, prop) for comp_id, prop in self.components]
        
        if isinstance(self.url, str):
            self.url = Component(id=self.url, prop='search')
    
    def build_sync_callback(self, app: dash.Dash):
        """
        Creates callbacks to synchronize component states with URL query parameters
        """
        
        outputs = [Output(x.id, x.prop) for x in self.components]
        outputs.append(Output(self.url.id, self.url.prop))  
        
        inputs = [Input(x.id, x.prop) for x in self.components]
        inputs.append(Input(self.url.id, self.url.prop))  
        
        @app.callback(
            outputs,
            inputs,
            prevent_initial_call=False
        )
        def sync_components_with_url(*args):
            # Component values are always index 0 to -2
            component_values = args[:-1]
            # The url is always the last argument
            url_search = args[-1] 
            
            if url_search.startswith('?'):
                url_search = url_search[1:]
            query_params = parse_qs(url_search)
            
            trigger_id = None
            trigger_prop = None
            if ctx.triggered:
                trigger_info = ctx.triggered[0]['prop_id'].split('.')
                if len(trigger_info) == 2:
                    trigger_id, trigger_prop = trigger_info
            
            component_returns = []
            new_query_params = {}
            
            if trigger_id == self.url.id and trigger_prop == 'search':
                # Iterate over components rather than url query so we can assure 
                # the order matches inputs/outputs
                for i, component in enumerate(self.components):
                    if (comp_id := component.id) in query_params:
                        param_value = query_params[comp_id][0]
                        try:
                            converted_value = literal_eval(param_value)
                        except (ValueError, SyntaxError):
                            # If it is a string, you need to wrap in double quotes or literal_eval fails.
                            converted_value = literal_eval(f"'{param_value}'")
                        component_returns.append(converted_value)
                        new_query_params[comp_id] = param_value
                    else:
                        # Use the value from the input state if not specified in the url
                        component_returns.append(component_values[i])
                        new_query_params[comp_id] = str(component_values[i])
                
                new_url_search = f"?{urlencode(new_query_params)}"
                # Make sure the url component is the final return value
                component_returns.append(new_url_search)
                
            else:
                for i, component in enumerate(self.components):
                    component_returns.append(component_values[i])
                    new_query_params[component.id] = str(component_values[i])
                
                new_url_search = f"?{urlencode(new_query_params)}"
                # Make sure the url component is the final return value
                component_returns.append(new_url_search)
            
            return component_returns


# Example usage with the previous dashboard
def create_synced_dashboard():
    """
    Example of how to use ComponentSync with a dashboard
    """
    import plotly.express as px
    import pandas as pd
    import numpy as np
    
    app = dash.Dash(__name__)
    
    # Generate sample data
    np.random.seed(42)
    base_data = pd.DataFrame({
        'x': range(1, 101),
        'y': np.cumsum(np.random.randn(100)) + 50
    })
    
    # Create ComponentSync instance
    sync_manager = ComponentSync(
        url="egg",
        components=[
            ('chart-type-dropdown', 'value'),
            ('color-theme-radio', 'value'),
            ('data-points-slider', 'value'),
            ('y-range-slider', 'value'),
            ('chart-title-input', 'value')
        ]
    )
    
    app.layout = html.Div([
        dcc.Location(id='egg', refresh=False),
        
        html.H1("Synced Interactive Dashboard", 
                style={'textAlign': 'center', 'marginBottom': '30px'}),
        
        # Controls section
        html.Div([
            html.H3("Controls (Synced with URL)", style={'marginBottom': '20px'}),
            
            html.Div([
                html.Div([
                    html.Label("Chart Type:", style={'fontWeight': 'bold'}),
                    dcc.Dropdown(
                        id='chart-type-dropdown',
                        options=[
                            {'label': 'Line Chart', 'value': 'line'},
                            {'label': 'Scatter Plot', 'value': 'scatter'},
                            {'label': 'Bar Chart', 'value': 'bar'},
                            {'label': 'Area Chart', 'value': 'area'}
                        ],
                        value='line'
                    )
                ], className='six columns'),
                
                html.Div([
                    html.Label("Color Theme:", style={'fontWeight': 'bold'}),
                    dcc.RadioItems(
                        id='color-theme-radio',
                        options=[
                            {'label': 'Blue', 'value': 'blues'},
                            {'label': 'Red', 'value': 'reds'},
                            {'label': 'Green', 'value': 'greens'},
                            {'label': 'Purple', 'value': 'purples'}
                        ],
                        value='blues'
                    )
                ], className='six columns')
            ], className='row'),
            
            html.Div([
                html.Div([
                    html.Label("Data Points:", style={'fontWeight': 'bold'}),
                    dcc.Slider(
                        id='data-points-slider',
                        min=10,
                        max=100,
                        step=10,
                        value=50,
                        marks={i: str(i) for i in range(10, 101, 20)},
                        tooltip={"placement": "bottom", "always_visible": True}
                    )
                ], className='six columns', style={'marginBottom': '30px'}),
                
                html.Div([
                    html.Label("Y-Axis Range:", style={'fontWeight': 'bold'}),
                    dcc.RangeSlider(
                        id='y-range-slider',
                        min=0,
                        max=100,
                        step=5,
                        value=[20, 80],
                        marks={i: str(i) for i in range(0, 101, 20)},
                        tooltip={"placement": "bottom", "always_visible": True}
                    )
                ], className='six columns', style={'marginBottom': '30px'})
            ], className='row'),
            
            html.Div([
                html.Label("Chart Title:", style={'fontWeight': 'bold'}),
                dcc.Input(
                    id='chart-title-input',
                    type='text',
                    value='My Interactive Chart',
                    style={'width': '100%', 'padding': '8px'}
                )
            ])
        ], style={
            'backgroundColor': '#f9f9f9', 
            'padding': '20px', 
            'margin': '20px',
            'borderRadius': '10px'
        }),
        
        # Graph section
        html.Div([
            dcc.Graph(id='interactive-graph')
        ], style={'margin': '20px'}),
        
        # URL display for demonstration
        html.Div([
            html.H4("Current URL:"),
            html.Div(id='url-display')
        ], style={
            'backgroundColor': '#e9ecef', 
            'padding': '15px', 
            'margin': '20px',
            'borderRadius': '5px'
        })
    ])
    
    # Build the sync callback
    sync_manager.build_sync_callback(app)
    
    # Callback to update the graph (unchanged from original)
    @app.callback(
        Output('interactive-graph', 'figure'),
        [Input('chart-type-dropdown', 'value'),
         Input('color-theme-radio', 'value'),
         Input('data-points-slider', 'value'),
         Input('y-range-slider', 'value'),
         Input('chart-title-input', 'value')]
    )
    def update_graph(chart_type, color_theme, data_points, y_range, chart_title):
        if not all([chart_type, color_theme, data_points, y_range, chart_title]):
            return {}
            
        filtered_data = base_data.head(data_points).copy()
        
        color_scales = {
            'blues': px.colors.sequential.Blues,
            'reds': px.colors.sequential.Reds,
            'greens': px.colors.sequential.Greens,
            'purples': px.colors.sequential.Purples
        }
        
        if chart_type == 'line':
            fig = px.line(filtered_data, x='x', y='y', title=chart_title)
            fig.update_traces(line_color=color_scales[color_theme][6])
        elif chart_type == 'scatter':
            fig = px.scatter(filtered_data, x='x', y='y', title=chart_title,
                            color='y', color_continuous_scale=color_scales[color_theme])
        elif chart_type == 'bar':
            fig = px.bar(filtered_data, x='x', y='y', title=chart_title)
            fig.update_traces(marker_color=color_scales[color_theme][6])
        elif chart_type == 'area':
            fig = px.area(filtered_data, x='x', y='y', title=chart_title)
            fig.update_traces(fillcolor=color_scales[color_theme][4])
        
        fig.update_layout(
            yaxis_range=y_range,
            height=500,
            plot_bgcolor='white'
        )
        
        return fig
    
    # Callback to display current URL
    @app.callback(
        Output('url-display', 'children'),
        Input('egg', 'search')
    )
    def display_url(search):
        base_url = "http://localhost:8050"
        full_url = f"{base_url}{search}" if search else base_url
        return html.Code(full_url, style={'fontSize': '14px'})
    
    return app

if __name__ == '__main__':
    app = create_synced_dashboard()
    app.run(debug=True, port=8050)