from dataclasses import dataclass
from typing import Any

from dash import dcc, html, no_update, Dash
from dash.dependencies import Component, Input, Output, State

AppLayout = list[dict[str, Any]]


def update_component_state(
    layout: list[dict[str, Any]],
    updated: None | list[dict[str, Any]] = None,
    **kwargs: dict[str, Any]
) -> list[dict[str, Any]]:
    """
    Recursively updates values in a Dash app layout.

    Parameters:
        layout (list[dict[str, Any]]): The Dash app layout to be updated.
        updated (Optional[list[dict[str, Any]]]): A list to store the updated layout.
            Defaults to None, and a new list will be created.
        **kwargs (Dict[str, Union[str, List]]): Keyword arguments where keys are
            component 'id' values in the app's layout, and values are dictionaries
            representing the component props and corresponding values to be applied.

    Returns:
        list[dict[str, Any]]: The updated Dash app layout.

    Example:
        # Update the component with id 'test1' a new 'children'
        # prop equal to 'it worked!!!'
        new_layout = update_component_state(
            layout=your_layout, updated=None, test1={'children': 'it worked!!!'}
        )
    """
    if updated is None:
        updated = []

    for item in layout:
        props = item["props"]

        children = props.get("children", None)
        if children and isinstance(children, list):
            props["children"] = update_component_state(children, None, **kwargs)

        id = props.get("id", "")
        id = id.replace("-", "_")
        if id not in kwargs:
            updated.append(item)
            continue

        props.update(kwargs[id])
        item["props"] = props
        updated.append(item)

    return updated


@dataclass
class DashShare:
    app: Dash
    interval_trigger: tuple
    layout_id: str = "app-layout"
    store_id: str = "triggered-by"
    store_value: str = "triggered"
    interval_id: str = "update-timer"

    def _make_state_tracker_components(self):
        return [
            dcc.Store(id=self.store_id, storage_type="memory", data=""),
            dcc.Interval(
                id=self.interval_id,
                interval=5000,
                disabled=True,
                max_intervals=1,
            ),
        ]

    def update_layout(self, layout):
        return html.Div(
            id=self.layout_id,
            children=[layout, *self._make_state_tracker_components()],
        )

    def prevent_update(self, func):
        def inner(*args, **kwargs):
            if self.store_value in args:
                return no_update
            return func(*args, **kwargs)

        return inner

    def register_callbacks(self):

        @self.app.callback(
            Output(self.interval_id, "disabled", allow_duplicate=True),
            Output(self.interval_id, "n_intervals"),
            Input(*self.interval_trigger),
            prevent_initial_call=True,
        )
        def enable_interval(trigger):
            print("enabled")
            return False, 0


        @self.app.callback(
            Output(self.store_id, "data"),
            Input(self.interval_id, "n_intervals"),
            State(self.store_id, "data"),
            prevent_initial_call=True,
        )
        def replace_store(n, store):
            if n > 0:
                print("triggered")
                return ""
            return store