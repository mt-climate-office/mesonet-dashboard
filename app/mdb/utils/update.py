import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from dash import Dash, dcc, html, no_update
from dash.dependencies import Input, Output, State

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
class DashShare(ABC):
    app: Dash
    load_input: tuple
    save_input: tuple
    save_output: tuple
    layout_id: str = "app-layout"
    interval_id: str = "update-timer"
    interval_delay: int = 5000
    locked: bool = field(init=False)

    def __post_init__(self):
        self.locked = False

    def _make_state_tracker_components(self, *args):
        return [
            dcc.Interval(
                id=self.interval_id,
                interval=self.interval_delay,
                disabled=True,
                max_intervals=1,
            ),
            *args,
        ]

    def lock(self):
        self.locked = True

    def unlock(self):
        self.locked = False

    def update_layout(self, layout, *args):
        return html.Div(
            id=self.layout_id,
            children=[layout, *self._make_state_tracker_components(*args)],
        )

    def pause_update(self, func):
        def inner(*args, **kwargs):
            if self.locked:
                return no_update
            return func(*args, **kwargs)

        return inner

    @abstractmethod
    def save(self, input, state):
        pass

    @abstractmethod
    def load(self, input, state):
        pass

    def register_callbacks(self):
        @self.app.callback(
            Output(self.interval_id, "disabled", allow_duplicate=True),
            Output(self.interval_id, "n_intervals"),
            Input(*self.load_input),
            prevent_initial_call=True,
        )
        def enable_interval(trigger):
            print("locking")
            self.lock()
            return False, 0

        @self.app.callback(
            Output(self.interval_id, "disabled", allow_duplicate=True),
            Input(self.interval_id, "n_intervals"),
            prevent_initial_call=True,
        )
        def replace_store(n):
            if n > 0:
                print("unlocking")
                self.unlock()
                return True
            return False

        @self.app.callback(
            Output(*self.save_output),
            Input(*self.save_input),
            State(self.layout_id, "children"),
        )
        def save(input, state):
            return self.save(input, state)

        @self.app.callback(
            Output(self.layout_id, "children"),
            Input(*self.load_input),
            State(self.layout_id, "children"),
        )
        def load(input, state):
            return self.load(input, state)


class FileShare(DashShare):
    def load(self, input, state):
        if input:
            with open("./test.json", "rb") as file:
                state = json.load(file)
            return state
        return state

    def save(self, input, state):
        if input is not None and input > 0:

            state = update_component_state(
                state, None, test1={"children": "Surprise!!!!"}
            )

            with open("./test.json", "w") as json_file:
                json.dump(state, json_file, indent=4)
        return input
