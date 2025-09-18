"""
State Management and Sharing Utilities for Montana Mesonet Dashboard

This module provides functionality for saving and loading dashboard state,
enabling users to share specific plot configurations and data selections
via URL parameters. It includes utilities for recursive layout updates
and persistent state management.

Key Components:
- DashShare: Abstract base class for state sharing implementations
- FileShare: File-based state persistence (used in main app)
- update_component_state(): Recursive layout state updates
- URL-based state encoding and sharing

The module enables users to save dashboard configurations and share them
with others through generated URLs, supporting reproducible analysis workflows.
"""

import json
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from hashlib import shake_128
from typing import Any, Dict, List, Optional, Tuple, Union
from urllib.parse import urlparse

import dash_bootstrap_components as dbc
from dash import Dash, dcc, html, no_update
from dash.dependencies import Input, Output, State

AppLayout = Union[List[Dict[str, Any]], Dict[str, Any]]


def update_component_state(
    layout: AppLayout,
    updated: Optional[AppLayout] = None,
    **kwargs: Dict[str, Any],
) -> AppLayout:
    """
    Recursively update component properties in a Dash app layout.

    Traverses the nested layout structure to find components by ID and
    update their properties. Handles both list and dictionary layout
    structures, preserving the overall layout hierarchy.

    Args:
        layout (AppLayout): The Dash app layout to be updated. Can be a list
            of components or a single component dictionary.
        updated (Optional[AppLayout]): Container for the updated layout.
            If None, creates appropriate container type.
        **kwargs (Dict[str, Any]): Component updates where keys are component
            IDs (with hyphens replaced by underscores) and values are
            dictionaries of properties to update.

    Returns:
        AppLayout: Updated layout with component properties modified according
            to the provided kwargs.

    Example:
        # Update component with id 'test-button' to have new text
        new_layout = update_component_state(
            layout=app_layout,
            test_button={'children': 'Updated Text', 'disabled': True}
        )

    Note:
        - Component IDs in kwargs should use underscores instead of hyphens
        - Recursively processes nested children and props structures
        - Preserves layout structure while updating specified components
        - Handles string and None values as terminal cases
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
    """
    Abstract base class for implementing dashboard state sharing functionality.

    Provides the framework for saving and loading dashboard states, enabling
    users to share specific configurations via URLs. Subclasses implement
    the actual storage mechanism (file-based, database, etc.).

    Attributes:
        app (Dash): The Dash application instance.
        load_input (tuple): Input specification for load trigger (component_id, property).
        save_input (tuple): Input specification for save trigger (component_id, property).
        save_output (tuple): Output specification for save feedback (component_id, property).
        url_input (str): Component ID for URL input (typically 'url').
        layout_id (str): ID of the main layout container. Defaults to 'app-layout'.
        interval_id (str): ID of the interval component for state updates.
            Defaults to 'update-timer'.
        modal_id (str): ID of the modal for sharing links. Defaults to 'save-modal'.
        link_id (str): ID of the text area containing shareable URL. Defaults to 'url-link'.
        interval_delay (int): Delay in milliseconds for state update interval.
            Defaults to 2000.
        locked (bool): Internal flag to prevent callback loops during state loading.
    """

    app: Dash
    load_input: Tuple[str, str]
    save_input: Tuple[str, str]
    save_output: Tuple[str, str]
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
        """
        Decorator to prevent callback execution during state loading.

        Wraps callback functions to return no_update when the state
        manager is locked, preventing callback loops during state
        restoration operations.

        Args:
            func: Callback function to wrap.

        Returns:
            Wrapped function that respects the locked state.
        """

        def inner(*args, **kwargs):
            if self.locked:
                return no_update
            return func(*args, **kwargs)

        return inner

    @abstractmethod
    def save(self, input: Any, state: AppLayout, hash: str) -> Any:
        """
        Save the current dashboard state.

        Abstract method that subclasses must implement to define
        how dashboard state is persisted (file, database, etc.).

        Args:
            input: Trigger input value (e.g., button clicks).
            state: Current dashboard layout state.
            hash: Unique identifier for the saved state.

        Returns:
            Updated input value or confirmation of save operation.
        """
        pass

    @abstractmethod
    def load(self, input: Any, state: AppLayout) -> AppLayout:
        """
        Load a previously saved dashboard state.

        Abstract method that subclasses must implement to define
        how saved states are retrieved and applied.

        Args:
            input: Load trigger input (e.g., URL parameters).
            state: Current dashboard layout state.

        Returns:
            Updated layout state with loaded configuration.
        """
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
    def encode(state: AppLayout, n: int = 4) -> str:
        """
        Generate a short hash identifier for a dashboard state.

        Creates a compact, URL-safe identifier for saved states using
        the SHAKE-128 cryptographic hash function.

        Args:
            state (AppLayout): Dashboard state to encode.
            n (int): Length of hash in bytes. Defaults to 4 (8 hex characters).

        Returns:
            str: Hexadecimal hash string for the state.

        Note:
            - Uses JSON serialization for consistent state representation
            - SHAKE-128 provides good collision resistance for short hashes
            - 4-byte hashes provide ~4 billion unique identifiers
        """
        return shake_128(json.dumps(state).encode("utf-8")).hexdigest(n)

    @staticmethod
    def get_url_base(url: str) -> str:
        """
        Extract the base URL for generating shareable links.

        Constructs the appropriate base URL considering deployment
        environment (local development vs. server deployment).

        Args:
            url (str): Current page URL.

        Returns:
            str: Base URL for constructing shareable state links.

        Note:
            - Adds '/dash' prefix for server deployments
            - Handles both development and production environments
            - Used for generating shareable state URLs
        """
        on_server = os.getenv("ON_SERVER")

        parsed_url = urlparse(url)
        end = "" if on_server is None or not on_server else "/dash"
        return f"{parsed_url.scheme}://{parsed_url.netloc}{end}"
