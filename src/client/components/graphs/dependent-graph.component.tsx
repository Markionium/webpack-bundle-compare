import * as cytoscape from 'cytoscape';
import * as React from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import { Stats } from 'webpack';
import {
  compareAllModules,
  getDirectImportsOfNodeModule,
  getImportersOfIdentifier,
  getNodeModuleFromIdentifier,
  normalizeIdentifier,
  replaceLoaderInIdentifier,
} from '../../stat-reducers';
import { color, linkToModule, linkToNodeModule } from '../util';
import { BaseGraph, expandModuleComparison } from './base-graph.component';

interface IProps {
  previous: Stats.ToJsonOutput;
  stats: Stats.ToJsonOutput;
  chunkId?: number;
}

interface IState {
  nodes: cytoscape.NodeDefinition[];
  edges: cytoscape.EdgeDefinition[];
  entries: string[];
}

const createDependentGraph = <P extends {}>(
  rootFinder: (props: IProps & P) => Stats.FnModules[],
  rootLabel: (props: IProps & P) => string,
) =>
  withRouter(
    class DependentGraph extends React.PureComponent<IProps & P & RouteComponentProps<{}>, IState> {
      public state: IState = this.buildData();

      public componentDidUpdate(prevProps: IProps & P & RouteComponentProps<{}>) {
        if (
          this.props.stats !== prevProps.stats ||
          this.props.chunkId !== this.props.chunkId ||
          rootFinder(this.props)
            .map(m => m.identifier)
            .join(',') !==
            rootFinder(prevProps)
              .map(m => m.identifier)
              .join(',')
        ) {
          this.setState(this.buildData());
        }
      }

      public render() {
        return (
          <BaseGraph
            edges={this.state.edges}
            nodes={this.state.nodes}
            rootNode={this.state.entries}
            width="100%"
            height={window.innerHeight * 0.9}
            onClick={this.onClick}
          />
        );
      }

      private buildData() {
        const directImports = rootFinder(this.props);
        const comparisons = compareAllModules(
          this.props.previous,
          this.props.stats,
          this.props.chunkId,
        );

        const { nodes, edges } = expandModuleComparison(
          comparisons,
          directImports
            .map(imp => comparisons[normalizeIdentifier(imp.identifier)])
            .filter(ok => !!ok),
        );

        for (const edge of edges) {
          [edge.data.source, edge.data.target] = [edge.data.target, edge.data.source];
        }

        nodes.push({
          data: {
            id: 'index',
            label: rootLabel(this.props),
            fontColor: '#fff',
            bgColor: color.blue,
            width: 20,
            height: 20,
          },
        });

        for (const direct of directImports) {
          edges.push({
            data: {
              id: `${direct.identifier}toIndex`,
              source: direct.identifier,
              target: 'index',
            },
          });
        }

        return { nodes, edges, entries: ['index'] };
      }

      private readonly onClick = (nodeId: string) => {
        const nodeModule = getNodeModuleFromIdentifier(nodeId);
        this.props.history.push(nodeModule ? linkToNodeModule(nodeModule) : linkToModule(nodeId));
      };
    },
  );

/**
 * Graphs the dependent tree for a node module.
 */
export const NodeModuleDependentGraph = createDependentGraph<{ name: string }>(
  props => getDirectImportsOfNodeModule(props.stats, props.name),
  props => props.name,
);

/**
 * Graphs the dependent tree for a node module.
 */
export const GenericDependentGraph = createDependentGraph<{ root: Stats.FnModules }>(
  props => getImportersOfIdentifier(props.stats, props.root.identifier),
  props => replaceLoaderInIdentifier(props.root.name),
);