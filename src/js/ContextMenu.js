var ContextMenu = React.createClass({
  getInitialState: function(){
    return {
      contextMenuItems: this.props.contextMenuItems
    };
  },
  render: function(){
    return (
      <ul>
        {this.state.contextMenuItems}
      </ul>
    );
  }
});
