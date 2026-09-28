import { type RouteParams, type State } from './types';

export function getCurrentRoute(state?: State) {
  if (!state) {
    return { name: 'Home', params: undefined };
  }

  /*
   * Nested navigator states may still be partial ("stale") right after a cold
   * start from a deep link, in which case `index` is not set yet. React
   * Navigation focuses the last route when it rehydrates such a state, so
   * mirror that here instead of stopping the descent early and misreporting
   * the tab root as the current route (which e.g. re-enabled the drawer
   * swipe gesture on top of a deep-linked screen).
   */
  let node = state.routes[state.index || 0];
  while (node.state?.routes) {
    node = node.state.routes[node.state.index ?? node.state.routes.length - 1];
  }
  return node;
}

type ExistingState = {
  name: string;
  params?: RouteParams;
};
export function buildStateObject(
  stack: string,
  route: string,
  params: RouteParams,
  state: ExistingState[] = [],
) {
  if (stack === 'Flat') {
    return {
      index: 0,
      routes: [{ name: route, params }],
    };
  }
  /*
   * Set `index` explicitly so consumers of this state (e.g. getCurrentRoute)
   * can tell which route is focused before React Navigation has rehydrated
   * the nested navigator state.
   */
  const routes = [...state, { name: route, params }];
  return {
    index: 0,
    routes: [
      {
        name: stack,
        state: {
          index: routes.length - 1,
          routes,
        },
      },
    ],
  };
}
