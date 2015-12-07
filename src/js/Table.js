var Table = React.createClass({
  getInitialState: function(){
    var socket = io.connect();
    socket.emit('initTable', this.props.id);
    return {
      id: this.props.id,
      socket: socket,
      // dimensions (TODO get from window)
      height: 1000,
      width: 1000,
      // will be filled in after render
      tablespaces: []
    };
  },
  updateTableState: function(data){
    var tablespacesWithData = data;
    // define dimensions
    // TODO noooott ssuuurrreee.......
    // this will eventually scale but we'll figure it out then, for now just defined statically here
    // size = element size + border
    // xIncrease = css border+margin+padding (2+10+0)
    var tablespaceDimensions = {x: 70, xIncrease: 12, y: 90, yIncrease: 6};

    // create a number of tablespaces based on dimensions of table
    // TODO account for border other than just +2
    var tablespacesX = Math.floor(this.state.width / (tablespaceDimensions.x + tablespaceDimensions.xIncrease));
    var tablespacesY = Math.floor(this.state.height / (tablespaceDimensions.y + tablespaceDimensions.yIncrease));
    var tablespaces = [];
    var x, y;
    for(y = 1; y <= tablespacesY; y++){
      for(x = 1; x <= tablespacesX; x++){
        var tablespaceId = y + ":" + x;
        var cards = (tablespacesWithData[tablespaceId])
          ? tablespacesWithData[tablespaceId]['cards'].map(function(card){

            // inject card markup depending on whether it's faceup or down
            var markupComponent;
            if(card.face_up){
              markupComponent = <CardMarkup markup={card.front_markup} />;
            } else {
              markupComponent = <CardMarkup markup={card.back_markup} />;
            }

            return (
              <Card
                id={card.id}
                key={card.id}
                tablespaceId={tablespaceId}
                ordinal={card.ordinal}
                socket={this.state.socket}
                markupComponent={markupComponent}
                color={card.color}
                pile = {card.pile}
                cardsInPile = {card.cards_in_pile}
              />
            );
          }.bind(this))
          : [];
        tablespaces.push(<Tablespace id={tablespaceId} key={tablespaceId} socket={this.state.socket} cards={cards} width={tablespaceDimensions.x} height={tablespaceDimensions.y} />);
      }
    }
    this.setState({tablespaces: []});
    this.setState({tablespaces: tablespaces});
  },
  componentDidMount: function(){
    // setup websocket listener for updates
    this.state.socket.on('updateTable', this.updateTableState);
  },
  dimensionsStyle: function(){
    return { width: this.state.width + 'px', height: this.state.height + 'px' };
  },
  render: function(){
    return (
      <div className="table" style={this.dimensionsStyle()} >
        {this.state.tablespaces}
      </div>
    );
  }
});
