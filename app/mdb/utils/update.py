import json
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from hashlib import shake_128
from typing import Any
from urllib.parse import urlparse

import dash_bootstrap_components as dbc
from dash import Dash, dcc, html, no_update
from dash.dependencies import Input, Output, State

AppLayout = list[dict[str, Any]]


def update_component_state(
    layout: list[dict[str, Any]] | dict[str, Any],
    updated: None | list[dict[str, Any]] = None,
    **kwargs: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Recursively updates values in a Dash app layout.

    Parameters:
        layout (list[dict[str, Any]] | dict[str, Any]): The Dash app layout to be updated.
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
        updated = [] if isinstance(layout, list) else {}

    if isinstance(layout, dict):
        if "children" in layout:
            layout["children"] = update_component_state(
                layout["children"], None, **kwargs
            )
        if "props" in layout:
            layout["props"] = update_component_state(layout["props"], None, **kwargs)
        if "id" in layout:
            id = layout["id"].replace("-", "_")
            if id in kwargs:
                layout.update(kwargs[id])

        return layout

    if isinstance(layout, str) or layout is None:
        return layout

    for item in layout:
        props = item["props"]
        children = props.get("children", None)
        if children and isinstance(children, dict):
            if "children" in children.get("props", "") or "props" in children:
                children["props"] = update_component_state(
                    children["props"], None, **kwargs
                )
            elif "children" in children:
                children["children"] = update_component_state(
                    children["children"], None, **kwargs
                )
            else:
                raise ValueError("Not Expected App Structure")

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
    url_input: str
    layout_id: str = "app-layout"
    interval_id: str = "update-timer"
    modal_id: str = "save-modal"
    link_id: str = "url-link"
    interval_delay: int = 2000
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
            dbc.Modal(
                children=[
                    dbc.ModalHeader(),
                    dbc.ModalBody(
                        dcc.Markdown(
                            """
                        #### Copy link below to share data:
                        The link will stay active for 90 days.
                        """
                        )
                    ),
                    html.Div(
                        [
                            dcc.Textarea(
                                id=self.link_id,
                                value="",
                                style={"height": 50, "width": "100%"},
                            ),
                            dcc.Clipboard(
                                target_id=self.link_id,
                                title="Copy URL",
                                style={
                                    "display": "inline-block",
                                    "fontSize": 20,
                                    "verticalAlign": "center",
                                    "paddingLeft": "5px",  # Adjust the value as needed
                                },
                            ),
                        ],
                        style={
                            "display": "flex",
                            "justifyContent": "center",
                            "padding": "15px",
                        },
                    ),
                ],
                id=self.modal_id,
                is_open=False,
                size="md",
                centered=True,
                scrollable=True,
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
    def save(self, input, state, hash):
        pass

    @abstractmethod
    def load(self, input, state):
        pass

    def register_callbacks(self):
        @self.app.callback(
            Output(self.interval_id, "disabled", allow_duplicate=True),
            Output(self.interval_id, "n_intervals", allow_duplicate=True),
            Input(*self.load_input),
            State(self.interval_id, "disabled"),
            State(self.interval_id, "n_intervals"),
            prevent_initial_call=True,
        )
        def enable_interval(trigger, dis, n):
            if trigger:
                print("locked")
                self.lock()
                return False, 0
            self.unlock()
            return False, 0

        @self.app.callback(
            Output(self.interval_id, "disabled", allow_duplicate=True),
            Output(self.interval_id, "n_intervals", allow_duplicate=True),
            Input(self.interval_id, "n_intervals"),
            prevent_initial_call=True,
        )
        def replace_store(n):
            if n is not None and n > 0:
                print("unlocked")
                self.unlock()
                return True, 1
            return False, 0

        @self.app.callback(
            Output(*self.save_output),
            Output(self.modal_id, "is_open"),
            Output(self.link_id, "value"),
            Input(*self.save_input),
            State(self.layout_id, "children"),
            State(self.modal_id, "is_open"),
            State(self.url_input, "href"),
        )
        @self.pause_update
        def save(input, state, is_open, url):
            hashed_url = self.encode(state)
            output = self.save(input, state, hash=hashed_url)
            if input:
                return (
                    output,
                    not is_open,
                    f"{self.get_url_base(url)}/?state={hashed_url}",
                )
            return output, is_open, ""

        @self.app.callback(
            Output(self.layout_id, "children"),
            Input(*self.load_input),
            State(self.layout_id, "children"),
        )
        def load(input, state):
            return self.load(input, state)

    @staticmethod
    def encode(state, n=4):
        return shake_128(json.dumps(state).encode("utf-8")).hexdigest(n)

    @staticmethod
    def get_url_base(url):
        on_server = os.getenv("ON_SERVER")

        parsed_url = urlparse(url)
        end = "" if on_server is None or not on_server else "/dash"
        return f"{parsed_url.scheme}://{parsed_url.netloc}{end}"
