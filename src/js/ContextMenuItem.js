var ContextMenuItem = React.createClass({
  getInitialState: function(){
    return {
      text: this.props.text,
      onClickFunction: this.props.onClickFunction
    };
  },
  render: function(){
    return (
      <li><a href="#" onClick={this.state.onClickFunction}>{this.state.text}</a></li>
    );
  }
});
