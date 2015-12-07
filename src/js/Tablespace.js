var Tablespace = React.createClass({
  getInitialState: function(){
    return {
      id: this.props.id,
      height: this.props.height,
      width: this.props.width,
      cards: this.props.cards,
      tableSocket: this.props.socket
    };
  },
  dimensionsStyle: function(){
    return { minHeight: (this.state.height) + 'px', minWidth: this.state.width + 'px' };
  },
  sortedCards: function(){
    return this.state.cards.sort(function(a,b){
      if(a.props.ordinal > b.props.ordinal){
        return 1;
      }
      if(a.props.ordinal < b.props.ordinal){
        return -1;
      }
      return 0;
    });
  },
  dragOver: function(event){
    event.preventDefault();
  },
  drop: function(event){
    event.preventDefault();
    var cardId = event.dataTransfer.getData("cardId");
    var deckName = event.dataTransfer.getData("deckName");

    // dragging a card onto this tablespace
    if(cardId){
      var cardPile = event.dataTransfer.getData("cardPile");
      var oldTablespaceId = event.dataTransfer.getData("oldTablespaceId");
      var oldOrdinal = parseInt(event.dataTransfer.getData("oldOrdinal"));
      // should only fire if this is an empty tablespace
      if(this.state.cards.length == 0){
        this.state.tableSocket.emit(
          'moveCardPosition',
          {
            cardId: cardId,
            oldTablespaceId: oldTablespaceId,
            newTablespaceId: this.state.id,
            oldOrdinal: oldOrdinal,
            newOrdinal: 0
          }
        );
      }
    }

    // dragging a deck onto this tablespace
    if(deckName){
      this.state.tableSocket.emit('loadDeck', {deckName: deckName, tablespaceId: this.state.id});
    }
  },
  render: function(){
    return (
      <div className="tablespace" style={this.dimensionsStyle()} onDragOver={this.dragOver} onDrop={this.drop}>
        {this.sortedCards()}
      </div>
    )
  }
});
