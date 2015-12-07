var Card = React.createClass({
  getInitialState: function(){
    return {
      id: this.props.id,
      tablespaceId: this.props.tablespaceId,
      markupComponent: this.props.markupComponent,
      color: this.props.color,
      ordinal: this.props.ordinal,
      isPile: (this.props.pile) ? true : false,
      pile: this.props.pile,
      cardsInPile: this.props.cardsInPile,

      // events
      tableSocket: this.props.socket,

      // UI
      isDragHovered: false,
      contextMenu: false
    };
  },
  dragStart: function(event){
    this.setState({isDragging: true});
    event.dataTransfer.setData("cardId", this.state.id);
    event.dataTransfer.setData("oldTablespaceId", this.state.tablespaceId);
    event.dataTransfer.setData("oldOrdinal", this.state.ordinal);
    event.dataTransfer.setData("cardPile", this.state.pile);
  },
  dragEnd: function(event){
    this.setState({isDragging: false});
  },
  dragOver: function(event){
    if(!this.state.isDragging){
      var viewportOffset = event.currentTarget.getBoundingClientRect();
      if(event.clientY < (event.currentTarget.offsetHeight + viewportOffset.top) - (event.currentTarget.offsetHeight * .5)){
        this.setState({isDragHoveredAbove: true, isDragHovered: true});
      } else {
        this.setState({isDragHoveredAbove: false, isDragHovered: true});
      }
    }
  },
  dragLeave: function(event){
    this.setState({isDragHovered: false, isDragHoveredAbove: false});
  },
  mouseEnter: function(event){
    this.setState({isHovered: true});
  },
  mouseLeave: function(event){
    this.setState({isHovered: false, contextMenu: false});
  },
  contextMenu: function(event){
    event.preventDefault();
    this.setState({contextMenu: true});
  },
  drop: function(event){
    event.preventDefault();
    var cardId = event.dataTransfer.getData("cardId");
    if(cardId){
      var cardPile = event.dataTransfer.getData("cardPile");
      var oldTablespaceId = event.dataTransfer.getData("oldTablespaceId");
      var oldOrdinal = parseInt(event.dataTransfer.getData("oldOrdinal"));
      var newOrdinal;
      if(this.state.isDragHovered){
        if(oldTablespaceId == this.state.tablespaceId){
          newOrdinal = (this.state.isDragHoveredAbove) ? ((this.state.ordinal-1 > 0) ? (this.state.ordinal-1) : 0) : (this.state.ordinal);
        } else {
          newOrdinal = (this.state.isDragHoveredAbove) ? this.state.ordinal : (this.state.ordinal+1);
        }
        this.state.tableSocket.emit(
          'moveCardPosition',
          {
            cardId: cardId,
            cardPile: cardPile,
            oldTablespaceId: oldTablespaceId,
            newTablespaceId: this.state.tablespaceId,
            oldOrdinal: oldOrdinal,
            newOrdinal: newOrdinal
          }
        );
      }
    }
  },
  distanceFromTop: function(){
    // if this is a pile we need to maneuver the ordinal so that it doesn't make gaps
    return ((this.state.ordinal * 10) - ((this.state.cardsInPile-1) * 10)) + 'px';
  },
  cardStyle: function(){
    return { backgroundColor: this.state.color, top: this.distanceFromTop() }
  },
  makePile: function(){
    this.state.tableSocket.emit('pileTablespace', {tablespaceId: this.state.tablespaceId});
  },
  contextMenuItems: function(){
    var contextMenuItems = [];
    if(this.state.isPile){
      contextMenuItems.push(<ContextMenuItem key="shufflePile" text="Shuffle Pile" onClickFunction={this.shufflePile} />);
      contextMenuItems.push(<ContextMenuItem key="turnOverCard" text="Turn Over Top Card" onClickFunction={this.turnOverCard} />);
      contextMenuItems.push(<ContextMenuItem key="turnOverPile" text="Turn Over All Cards" onClickFunction={this.turnOverPile} />);
    } else {
      contextMenuItems.push(<ContextMenuItem key="makePile" text="Pile Tablespace" onClickFunction={this.makePile} />);
      contextMenuItems.push(<ContextMenuItem key="turnOverCard" text="Turn Over" onClickFunction={this.turnOverCard} />);
    }
    return contextMenuItems;
  },
  render: function(){
    var classes = classNames({
      'card': true,
      'card-hovered': this.state.isHovered && !this.state.isDragHovered,
      'card-drag-hovered-above': this.state.isDragHovered && this.state.isDragHoveredAbove,
      'card-drag-hovered-below': this.state.isDragHovered && !this.state.isDragHoveredAbove
    });
    if(this.state.contextMenu){
      var contextMenu = <ContextMenu contextMenuItems={this.contextMenuItems()}/>;
    }
    return (
      <div
        key={this.state.id}
        draggable="true"
        className={classes}
        style={this.cardStyle()}
        onDragOver={this.dragOver}
        onDragLeave={this.dragLeave}
        onDragStart={this.dragStart}
        onDrop={this.drop}
        onMouseEnter={this.mouseEnter}
        onMouseLeave={this.mouseLeave}
        onContextMenu={this.contextMenu}
      >
      {this.state.markupComponent}
      {contextMenu}
      </div>
    );
  }
});
