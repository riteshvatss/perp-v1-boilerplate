import express from "express";

const app = express();
const port =3000;
app.use(express.json());

const users = [{
    userId: 1,
    username: "harkirat",
    password: 123123,
    collateral: {
         availabe: 2000,
         locked: 1000
    },
     positions: [
        { market: "SOL", type: "LONG", qty: 10, margin: 500, liquidationPrice: 80, averagePrice: 90 },
        { market: "ETH", type: "SHORT", qty: 1, margin: 500, liquidationPrice: 2000, averagePrice: 1900 }
    ],
    orders: [
        { orderId: 1, market: "SOL", type: "LONG", qty: 10, margin: 500, orderType: "limit", price: 90, status: "filled" },
        { orderId: 2, market: "ETH", type: "SHORT", qty: 10, margin: 500, orderType: "limit", price: 1900, status: "filled" },
        { orderId: 3, market: "BTC", type: "LONG", qty: 10, margin: 500, orderType: "limit", price: 1900, status: "cancelled" },
    ]
}, {
    userId: 2,
    username: "raman",
    password: 123123,
    collateral: {
         availabe: 2000,
         locked: 2000
    },
    positions: [
        { market: "SOL", type: "SHORT", qty: 10,  margin: 1000, liquidationPrice: 80, pnL: 200, averagePrice: 90 },
        { market: "ETH", type: "LONG", qty: 1, margin: 1000, liquidationPrice: 2000, pnL: -100, averagePrice: 1900 }
    ],
    orders: [
        { orderId: 10, market: "SOL", type: "SHORT", qty: 10, margin: 500, orderType: "market", price: 90, status: "filled" },
        { orderId: 11, market: "ETH", type: "LONG", qty: 10, margin: 500, orderType: "market", price: 1900, status: "filled" },
        { orderId: 12, market: "ZEC", type: "LONG", qty: 10, margin: 500, orderType: "limit", price: 1900, status: "open" },
    ]
}];

type Bid = {
    availableQty: number,
    openOrders: { userId: number, qty: number, filledQty: number, orderId: number, createdAt: Date }[]
}

type Orderbook = {
    bids: Record<string, Bid>,//here string is price
    asks: Record<string, Bid>,
    lastTradedPrice: number,
    indexPrice: number
}

type Orderbooks = Record<string, Orderbook>

const orderbooks: Orderbooks = {
     SOL: { bids: {}, asks: {}, lastTradedPrice: 90, indexPrice: 90.01 },
     ETH: { bids: {}, asks: {}, lastTradedPrice: 1900, indexPrice: 1899.9 }
}

const fills = [{
    maker: 1,
    taker: 2,
    market: "SOL",
    qty: 10,
    price: 90,
    long: 1,
    short: 2
}, {
    maker: 1,
    taker: 2,
    market: "ETH",
    qty: 1,
    price: 1900,
    long: 2,
    short: 1
}];

app.post("/signup", (req, res) => {

    const{username,password}=req.body;

    if(!username||!password){
        return res.status(401).json({msg:"username or password required"});
    }

    const user_found=users.map((user)=>user.username===username);

    if(user_found){
        return res.status(401).json({msg:"user already existed"});
    }

    const newUser={
        userId:users.length+1,
        username,
        password,
        collateral:{
            available:0,
            locked:0
        },
        positions:[],
        order:[]

    }

    users.push(newUser as any);

    return res.status(200).json({msg:"New user added Succesfully", newUser:newUser,userId:newUser.userId});

})
app.post("/signin", (req, res) => {

    const{username,password}=req.body;
  
     if(!username||!password){
        return res.status(401).json({msg:"username or password required"});
    }
   
    users.map((user)=>{
        if(user.username===username&&user.password===password){
            return res.status(200).json({msg:"user signed in succesfully",userData:user,userId:user.userId });
        }
        
    });

    return res.status(403).json({msg:"user not found or password incorrect"});

});
app.post("/onramp", (req, res) => {
    const {userId,amount}=req.body;

    if(!userId||amount<=0){
        return res.status(400).json({msg:"UserId required and amount should be greater than 0"});
    }

    const user=users.find((user)=>user.userId===userId);
    if(!user){
        return res.status(400).json({msg:"User doesnt exist in Database.Please Sign up"});
    }

    const availableAmount=user.collateral.availabe+amount;

    return res.status(200).json({msg:"Amount added to the Account",availableAmount:availableAmount,userId:userId})

});


app.post("/order", (req, res) => {
    const {userId,market,type,ordertype,qty,price,margin}=req.body;

    const user=users.find((u)=>u.userId===userId);

    if(!userId){
        return res.status(403).json({
            msg:"user not found"
        })
    }

    if (user!.collateral.availabe<margin){
        return res.status(400).json({
            msg:"Insufficient Fund"
        })
    }

    user!.collateral.availabe-=margin;
    user!.collateral.locked=margin;

     const allOrders = users.flatMap(u => u.orders)
    const newOrderId = allOrders.length > 0 ? Math.max(...allOrders.map(o => o.orderId)) + 1 : 1

    const newOrder={
        orderId:newOrderId,
        market,
        type,
        ordertype,
        qty,
        margin,
        price,
        status:"open"
    }

    user!.orders.push(newOrder);

    if(!orderbooks[market]){
        orderbooks[market]={bids:{},asks:{},lastTradedPrice: price, indexPrice: price}

    }

    let pricekey=String(price);
    let remainingQty=qty;

    const oppositeSide=type==="LONG"?orderbooks[market].asks:orderbooks[market].bids

    if(oppositeSide[pricekey]){ 
        
        const restingOrders=oppositeSide[pricekey].openOrders;

        for(let i=0;i<restingOrders.length&&i>remainingQty;i++){
                const restingorder=restingOrders[i];

                const mtchQty=Math.min(restingorder!.qty-restingorder!.filledQty,remainingQty);

                if(mtchQty>0){

                    fills.push({
                        maker:userId,
                        taker:restingorder!.userId,
                        market,
                        price,
                        qty:mtchQty,
                        long: type === "LONG" ? userId : restingorder!.userId,
                         short: type === "SHORT" ? userId : restingorder!.userId

                    });

                    remainingQty-=mtchQty;

                    restingorder!.filledQty+=mtchQty;

                    if (restingorder!.filledQty === restingorder!.qty) {
                    const makerUser = users.find(u => u.userId === restingorder!.userId)
                        if (makerUser) {
                            const makerOrder = makerUser.orders.find(o => o.orderId === restingorder!.orderId)
                            if (makerOrder) {
                                makerOrder.status = "filled"
                            }
                        }
                    }

                }
            }


           oppositeSide[pricekey].openOrders=restingOrders.filter((o)=>o.filledQty<o.qty);
           oppositeSide[pricekey].availableQty -= (qty-remainingQty);
           
           if(oppositeSide[pricekey].openOrders.length===0){
                delete oppositeSide[pricekey]
           }
    }

    if(remainingQty===0){
        newOrder.status="filled"
    }

    if(remainingQty>0){
        if(type==="LONG"){
            if(!orderbooks[market].bids[pricekey]){
                orderbooks[market].bids[pricekey]={availableQty:0,openOrders:[]}
            }

            orderbooks[market].bids[pricekey].availableQty+=qty;
            orderbooks[market].bids[pricekey].openOrders.push({
                userId,
                qty: remainingQty,
                filledQty: 0,
                orderId: newOrderId,
                createdAt: new Date()
            });      
        }else{

            if(!orderbooks[market].asks[pricekey]){
                orderbooks[market].asks[pricekey]={availableQty:0,openOrders:[]}
            }

            orderbooks[market].asks[pricekey].availableQty+=qty;

            orderbooks[market].asks[pricekey].openOrders.push({
                 userId,
                qty: remainingQty,
                filledQty: 0,
                orderId: newOrderId,
                createdAt: new Date()
            });

        }

    }

     res.json({
        orderId: newOrderId,
        status: newOrder.status
    })

})


app.delete("/order",(req,res)=>{
    const {userId,orderId}=req.body;

    const user=users.find((u)=>{
        u.userId===userId;
    })

    if(!user){
         return res.status(401).json({
            message: "User not found"
        })
    }

    const order=user.orders.find((o)=>{
        o.orderId===orderId
    })

    if(!order){
        return res.status(404).json({
            message: "Order not found"
        })
    }

    if(order.status!=="open"){
        return res.status(400).json({
            message: "Order is not open, cannot cancel"
        })
    }

    order.status = "cancelled";

    user.collateral.locked -= order.margin
    user.collateral.availabe += order.margin

    const market = orderbooks[order.market]
    if (market) {
        const side = order.type === "LONG" ? market.bids : market.asks
        const priceKey = String(order.price)
        if (side[priceKey]) {
            side[priceKey].openOrders = side[priceKey].openOrders.filter(o => o.orderId !== orderId)
            side[priceKey].availableQty -= order.qty
            if (side[priceKey].openOrders.length === 0) {
                delete side[priceKey]
            }
        }
    }

    res.json({
        message: "Order Cancelled",
        available: user.collateral.availabe
    })

})



app.get("/equity/available", (req, res) => {

    const userId=Number(req.query.userId);
    if(!userId){
        return res.status(400).json({
            msg:"Require UserId"
        });
    }

    const user=users.find((user)=>user.userId===userId);
    if(!user){
        return res.status(400).json({
            msg:"User doesnt exist"
        });
    }
    return res.status(200).json({availableAmount:user.collateral.availabe});
})


app.get("/positions/open/:marketId", (req, res) => {
        const userId=Number(req.query.userId);
        const {marketId}=req.params;

        if(!userId||!marketId){
            return res.status(400).json({
                msg:"Missing fields UserId or marketId"
            });
        }

        const user=users.find((user)=>user.userId===userId);

        if(!user){
            return res.status(400).json({
                msg:"user doesnt exist"
            })
        }
        
        const openPositions=user.positions.filter((position)=>position.market===marketId);

        res.status(200).json({
            msg:"Successful",
            openPositions:openPositions
        });


});



app.get("/positions/closed/:marketId", (req, res) => {

    const userId=Number(req.query.userId);
        const {marketId}=req.params;

        if(!userId||!marketId){
            return res.status(400).json({
                msg:"Missing fields UserId or marketId"
            });
        }

        const user=users.find((user)=>user.userId===userId);

        if(!user){
            return res.status(400).json({
                msg:"user doesnt exist"
            })
        }

        const closedPositions=user.positions.filter((position)=>position.qty===0);

        res.status(200).json({closedPositions:closedPositions});
        
});



app.get("/orders/open/:marketId", (req, res) => {
    const userId=Number(req.query.userId);
        const {marketId}=req.params;

        if(!userId||!marketId){
            return res.status(400).json({
                msg:"Missing fields UserId or marketId"
            });
        }

        const user=users.find((user)=>user.userId===userId);

        if(!user){
            return res.status(400).json({
                msg:"user doesnt exist"
            })
        }

        const openOrders=user.orders.filter((order)=>order.status==="open"&&order.market===marketId);

        res.status(200).json({
            openOrders:openOrders
        });


})
app.get("/orders/:marketId", (req, res) => {

    const userId=Number(req.query.userId);
        const {marketId}=req.params;

        if(!userId||!marketId){
            return res.status(400).json({
                msg:"Missing fields UserId or marketId"
            });
        }

        const user=users.find((user)=>user.userId===userId);

        if(!user){
            return res.status(400).json({
                msg:"user doesnt exist"
            })
        }

        const Orders=user.orders.find((order)=>order.market===marketId);

        res.status(200).json({
            Orders:Orders
        });


})
app.get("/fills", (req, res) => {
    const userId=Number(req.query.userId);
      

        if(!userId){
            return res.status(400).json({
                msg:"Missing field UserId"
            });
        }

        const user=users.find((user)=>user.userId===userId);

        if(!user){
            return res.status(400).json({
                msg:"user doesnt exist"
            })
        }

        const userFills=fills.filter((fill)=>fill.taker===userId||fill.maker===userId);

        res.status(200).json({userFills:userFills});

});






app.listen(port,()=>{
    console.log("running");
})