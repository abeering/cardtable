var Deck = React.createClass({
  getInitialState: function(){
    return {
      name: this.props.name,
      isDragging: false
    };
  },
  dragStart: function(event){
    this.setState({isDragging: true});
    event.dataTransfer.setData("deckName", this.state.name);
  },
  dragEnd: function(event){
    this.setState({isDragging: false});
  },
  render: function(){
    return (
      <li draggable="true" onDragStart={this.dragStart} className="deck">{this.state.name}</li>
    );
  }
});
