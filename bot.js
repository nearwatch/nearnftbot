const dotenv 	  = require('dotenv').config()
const Telegraf	= require('telegraf')
const bot 	    = new Telegraf(process.env.BOT_TOKEN,{handlerTimeout:100})  
const near	    = require('./near')
const level  	  = require('level')
const accounts	= level('./db/accounts')
const nfts	    = level('./db/nfts')
const keys	    = level('./db/keys')
const mainKB  	= [['🧡 Favorites']]

showWallet = (wallet) => /^[0-9a-f]{64}$/.exec(wallet)?wallet.substr(0,5)+'...'+wallet.substr(-10):wallet
getAccounts	= function (prefix, full){
    return new Promise(resolve => {
        const list = []
		const options = prefix?{keys:true, values:true, gt:prefix, lte:prefix+'\uFFFF'}:{keys:true, values:true}
        accounts.createReadStream(options)
        .on('data' ,data => list.push(prefix && !full?data.value:{key:data.key,value:data.value}))
        .on('error',err  => resolve({err:err}))
        .on('close',() => resolve(list))
    })
}
favorites = async function (id){
	const acclist = await getAccounts(id+'.')
	if (acclist.error) return {error:'Error getting a list of wallets'}
	const result = {text:'<b>Favorites: '+acclist.length+'</b>', kb:[[]]}
	for (let i=0;i<acclist.length;i++){
		if (i%2 && acclist.length>10) result.kb[result.kb.length-1].push({text:showWallet(acclist[i]), callback_data:acclist[i]})
		else result.kb.push([{text:showWallet(acclist[i]), callback_data:acclist[i]}])
	}
	return result
}
updateNTFs = async function (ctx,wallet,nobuffer){
	try{
		const data = JSON.parse(await nfts.get(wallet))
		if (ctx.callbackQuery) data.mess_id = ctx.callbackQuery.message.message_id
		if (!nobuffer){
			if (ctx.callbackQuery) await ctx.answerCbQuery()
			return data
		}	
		if (ctx.callbackQuery && data.date && (Date.now()-data.date < 180000)){
			await ctx.answerCbQuery('The last update was less than 3 minutes ago. Try later',true)
			data.break = 1
			return data
		}	
	}catch(err){}
	
	if (ctx.callbackQuery) await ctx.answerCbQuery()
	let mess
	if (ctx.callbackQuery) mess = await ctx.telegram.editMessageText(ctx.from.id,ctx.callbackQuery.message.message_id,null,'Loading NFTs list of '+wallet+'. It may take a few minutes')
	else mess = await ctx.reply('Loading NFTs list of '+wallet+'. It may take a few minutes')
	const contracts = await near.getNFTs(wallet)
	if (contracts.error) return {error:'NFT contracts loading error'}
	const paras = await near.getParas(wallet,0,1)
	if (paras && !paras.error) contracts.push('paras.id')

	let ptr = 0
	const result = {index:{}, data:[]} 
	for (const contactId of contracts){
		const list = await near.viewAccountNFT(contactId,wallet)
		if (!list || list.error || !list.length) continue
		if (!result.index[contactId]) result.index[contactId] = {start:ptr, length:0}
		for (let i=0;i<list.length;i++){
			if (!list[i] || list[i].error) continue
			result.index[contactId].length++
			ptr++
			result.data.push(list[i]) 
		}
	}	
	result.date = Date.now()
	result.total = result.data.length
	try{
		await nfts.put(wallet,JSON.stringify(result))
	}catch(err){}
	if (mess && mess.message_id) result.mess_id = mess.message_id
	return result
}	
function createKB(page,pages,prefix,noneCallback){
	const size = 7
	let st = page < Math.ceil(size/2)?0:page-Math.ceil(size/2)
	const list = [...Array(pages)].map((_,p) => p+1).slice(st,st+size)
	while (list[0]>1 && list.length<size) list.unshift(list[0]-1)
	const kb = list.map(e => {return {text:page==e?'· '+e+' ·':e, callback_data:page==e?noneCallback:prefix+e}})
	if (pages<=size) return [kb]	
	if (page>Math.ceil(size/2)) kb[0] = {text:'1 <',callback_data:prefix+'1'}
	if (page+Math.floor(size/2)<pages) kb[kb.length-1] = {text:'> '+pages,callback_data:prefix+pages}
	return [kb]	
}
nftCard = function (wallet,data,ptr=1){
	if (data.error) return {text:'<b>'+wallet+'</b> - NFTs loading error', kb:[[]]}
	if (!data.total) return {text:'<b>'+wallet+'</b> - no NFTs found', kb:[[]]}
	if (+ptr >= data.total) ptr = data.total
	const result = {text:'', kb:createKB(+ptr,data.total,'showNFTs','getWalletInfo')}
	result.text = '<b>'+wallet+'</b> - '+data.data[+ptr-1].text
	if (data.data[+ptr-1].token) result.text += '<a href="t.me/nft/'+data.data[+ptr-1].contract+'/'+data.data[+ptr-1].token+'">&#8203;</a>'
	result.text += '<a href="t.me/'+Date.now()+'">&#8203;</a>'
	return result
}	
showNFTs = async function (ctx,wallet){
	if (ctx.message && ctx.message.reply_to_message) return transferNFT(ctx)
	if (ctx.callbackQuery && !wallet){
		const exw = /^(.+?)\s/.exec(ctx.callbackQuery.message.text)
		if (exw) wallet = exw[1]
	}
	if (!wallet) return ctx.answerCbQuery('Wallet is unknown')
	wallet = wallet.toLowerCase()
	const result = await updateNTFs(ctx,wallet,ctx.match[2]==='1'?1:undefined)
	if (result.break) return
	const ptr = ctx.match[1] == +ctx.match[1]?ctx.match[1]:1
	const {text,kb} = nftCard(wallet,result,ptr)
	if (Object.keys(result.index).length && result.data[ptr-1] && result.data[ptr-1].contract && result.index[result.data[ptr-1].contract]){
		const ctrOffset  = result.index[result.data[ptr-1].contract]
		let nextPtr = ctrOffset.start+ctrOffset.length+1
		if (nextPtr>result.data.length) nextPtr = 1
		kb.push([{text:ctrOffset.length+' NFT(s) of '+result.data[ptr-1].contract+'  ➡️', callback_data:'showNFTs'+nextPtr}])
	}
	let inFav 
	try{
		inFav = await accounts.get(ctx.from.id+'.'+wallet)
	}catch(err){}
	kb.push([{text:'🔄 Update', callback_data:'showNFTs1:1'},{text:(inFav?'🧡':'🤍')+' Favorites', callback_data:(inFav?'del':'add')+'wallet'},{text:'🔎 Search', switch_inline_query_current_chat:wallet},{text:'❌ Close', callback_data:'closeMessage'}])
	if (!result.mess_id) return ctx.reply(text,{parse_mode:'HTML', reply_markup:{inline_keyboard:kb}})
	return ctx.telegram.editMessageText(ctx.from.id,result.mess_id,null,text,{parse_mode:'HTML', reply_markup:{inline_keyboard:kb}})
}
transferNFT = async function (ctx){
	const ents = ctx.message.reply_to_message.entities
	const errMess = 'Sorry, at the moment there is no possibility of transferring the NTF in this contract'
	if (!ents) return ctx.reply(errMess)
	const nftData = ents.find(e => /t\.me\/nft\/(.+?\.near)\/(.+)$/.exec(e.url))
	if (!nftData) return ctx.reply(errMess)
	const source = /^(.+?)\s/.exec(ctx.message.reply_to_message.text)
	if (!source || !/^([a-z0-9-_\.]{1,59}\.(near|testnet))$/i.exec(source[1])) return ctx.reply('Source wallet is unknown')
	const nft = /t\.me\/nft\/(.+?\.(near))\/(.+)$/.exec(nftData.url)
	const dest = ctx.message.text.toLowerCase()
	if (dest.split('.').pop()!=nft[2]) return ctx.reply('You can transfer only in same network')
	return transferPost(ctx,source[1],dest,nft[1],nft[3]) 
}	
transferPost = async function (ctx,source,dest,contract,token){
	console.log(source,dest,contract,token)
	let keydata, text = '<b>'+source+'</b> transfer NFT <code>'+token+'</code>\nto <b>'+dest+'</b>\ncontract: <code>'+contract+'</code>\n\n'
	const infoStr = 'If you are owner of <b>'+source+'</b>, press button "Grant" for grant bot\'s full access rights to make transactions\n\nNext step press button "Check" for check bot rights for activate "Transfer NFT" button'
	const key = ctx.from.id+'_'+contract+'_'+source
	try{
		keydata = JSON.parse(await keys.get(key))
		console.log('keydata',keydata)
		if (!keydata.active) text += infoStr
	}catch(err){
		keydata = near.loginURL(contract)
		text += infoStr
		try{
			await keys.put(key,JSON.stringify(keydata))
		}catch(err){console.log(err)}
	}
	const kb = [[{text:'Grant', url:keydata && keydata.url},{text:'Check', callback_data:'checkKeys'},{text:'New keys', callback_data:'newKeys'}]]
	if (keydata && keydata.active) kb.push([{text:'Transfer NFT', callback_data:'sendNFT'}])
	text += '<a href="t.me/'+Date.now()+'">&#8203;</a>'
	if (ctx.callbackQuery) return ctx.telegram.editMessageText(ctx.from.id,ctx.callbackQuery.message.message_id,null,text,{parse_mode:'HTML', reply_markup:{inline_keyboard:kb}})
	return ctx.reply(text,{parse_mode:'HTML', reply_markup:{inline_keyboard:kb}})
}	

bot.start(async ctx => {
	const startText = 'Send NEAR wallet address for view it\'s NFTs\n\nfor support @nearwatch'
	if (!ctx.startPayload) return ctx.reply(startText,{reply_markup:{keyboard:mainKB, resize_keyboard:true}})
	const wallet = /^([a-z0-9-_\.]{1,59}\.(near|testnet))\.?(\d+)?$/i.exec(ctx.startPayload.replace(/\__/g,'.'))
	if (!wallet) return ctx.reply(startText,{reply_markup:{keyboard:mainKB, resize_keyboard:true}})
	ctx.match = ['']
	if (wallet[3]) ctx.match.push(wallet[3])
	return showNFTs(ctx,wallet[1])
})
bot.action('closeMessage', ctx => ctx.deleteMessage())
bot.action('getWalletInfo', async ctx => {
	const wallet = /^(.+?)\s/i.exec(ctx.callbackQuery.message.text) 
	if (!wallet) return ctx.answerCbQuery('No wallet address found')
	try{
		const data = JSON.parse(await nfts.get(wallet[1]))
		if (data.index){
			const clist = Object.keys(data.index).map(key => ({key:key, value:data.index[key].length}))
			clist.sort((a,b)=>b.value-a.value)
			let text = '\nTotal: '+data.data.length+'\n'+clist.map(e => e.value+' '+e.key).join('\n')
			if (text.length>200) text = text.replace(/\.near/g,'') 
			if (text.length>200) text = text.replace(/\.mintbase(\d+)/g,'.mnt') 
			return ctx.answerCbQuery(text.substr(0,200),true)
		}
	}catch(err){}
	return ctx.answerCbQuery('No data found for the wallet ',true)
})
bot.action(/^newKeys$/, async ctx => {
	const wallet = /^(.+?)\stransfer NFT\s(.+?)\nto\s(.+?)\ncontract\:\s(\S+)/is.exec(ctx.callbackQuery.message.text) 
	if (!wallet) return ctx.answerCbQuery('No wallet address found for generate new keys',true)
	let keydata, key = ctx.from.id+'_'+wallet[4]+'_'+wallet[1]
	try{
		await keys.del(key)
	}catch(err){}
	await ctx.answerCbQuery('New key pair created')
	return transferPost(ctx,wallet[1],wallet[3],wallet[4],wallet[2])
})
bot.action(/^checkKeys$/, async ctx => {
	const wallet = /^(.+?)\stransfer NFT\s(.+?)\nto\s(.+?)\ncontract\:\s(\S+)/is.exec(ctx.callbackQuery.message.text) 
	if (!wallet) return ctx.answerCbQuery('No wallet address found for checking keys',true)
	let keydata, key = ctx.from.id+'_'+wallet[4]+'_'+wallet[1]
	try{
		keydata = JSON.parse(await keys.get(key))
	}catch(err){}
	if (!keydata) return ctx.answerCbQuery('Key verification error. Generate new keys',true)
	const keysList = await near.keysList(wallet[1])
	if (!keysList.find(e => e.public_key === keydata.public_key)) return ctx.answerCbQuery('No access rights',true)
	keydata.active = 1
	try{
		await keys.put(key,JSON.stringify(keydata))
	}catch(err){
		return ctx.answerCbQuery('Key verification error. Generate new keys',true)
	}
	await ctx.answerCbQuery('OK')
	return transferPost(ctx,wallet[1],wallet[3],wallet[4],wallet[2])
})
bot.action(/^sendNFT$/, async ctx => {
	const wallet = /^(.+?)\stransfer NFT\s(.+?)\nto\s(.+?)\ncontract\:\s(\S+)/is.exec(ctx.callbackQuery.message.text) 
	if (!wallet) return ctx.answerCbQuery('No wallet address found for transfer NFT',true)
	let keydata, key = ctx.from.id+'_'+wallet[4]+'_'+wallet[1]
	try{
		keydata = JSON.parse(await keys.get(key))
	}catch(err){}
	if (!keydata) return ctx.answerCbQuery('Access error. Generate new keys',true)
	const mess = await ctx.telegram.editMessageText(ctx.from.id,ctx.callbackQuery.message.message_id,null,ctx.callbackQuery.message.text.trim()+'Transfering in progress ...')
	const result = await near.transferNFT(keydata,wallet[4],wallet[2],wallet[1],wallet[3])
	await ctx.telegram.editMessageText(ctx.from.id,mess.message_id,null,mess.text+'\n\n'+(result.error?'Error: '+result.error:'Transaction is completed\n\n<code>'+keydata.public_key+'</code>\nYou can delete it\nhttps://wallet.near.org/full-access-keys\n<b>Be carefull! Only this key!</b>'),{parse_mode:'HTML'})
	return ctx.answerCbQuery(result.error?'Error: '+result.error:'Transaction is completed',true)
})
bot.action(/^(add|del)wallet$/, async ctx => {
	const wallet = /^(.+?)\s/i.exec(ctx.callbackQuery.message.text) 
	if (!wallet) return ctx.answerCbQuery('No wallet address found for '+(ctx.match[1]=='add'?'adding':'deleting'),true)
	if (ctx.match[1]=='add'){
		const acclist = await getAccounts(ctx.from.id+'.')
		if (acclist && acclist.length>19) return ctx.answerCbQuery('Only 20 wallets are allowed in the favorites',true)
	}
	try {
		if (ctx.match[1]=='add') await accounts.put(ctx.from.id+'.'+wallet[1],wallet[1])
		else await accounts.del(ctx.from.id+'.'+wallet[1])
	}catch(err){
		console.log(err)
		return ctx.answerCbQuery('Error '+(ctx.match[1]=='add'?'adding':'deleting')+' wallet',true)
	}
	const prevKb = ctx.callbackQuery.message.reply_markup && ctx.callbackQuery.message.reply_markup.inline_keyboard
	const isFav = prevKb && prevKb[prevKb.length-1] && prevKb[prevKb.length-1][1] && prevKb[prevKb.length-1][1] && /^(del|add)wallet/.exec(prevKb[prevKb.length-1][1].callback_data)
	if (!isFav) return ctx.answerCbQuery()
	prevKb[prevKb.length-1][1] = {text:(ctx.match[1]=='add'?'🧡':'🤍')+' Favorites', callback_data:(ctx.match[1]=='add'?'del':'add')+'wallet'}
	await ctx.telegram.editMessageReplyMarkup(ctx.from.id,ctx.callbackQuery.message.message_id,null,{inline_keyboard:prevKb})
	return ctx.answerCbQuery()
})
bot.action(/^showNFTs(\d+)?:?(\d)?$/, ctx => showNFTs(ctx))
bot.action(/^([a-z0-9-_\.]{1,59}\.(near|testnet))$/i, ctx => showNFTs(ctx,ctx.match[1]))
bot.action(/^([0-9a-f]{64})$/i, ctx => showNFTs(ctx,ctx.match[1]))
bot.hears(/^([a-z0-9-_\.]{1,59}\.(near|testnet))$/i, ctx => showNFTs(ctx,ctx.match[1]))
bot.hears(/^([0-9a-f]{64})$/i, ctx => showNFTs(ctx,ctx.match[1]))
bot.hears(/^\/?(🧡)?\s*favorites$/i, async ctx => {
	const fav = await favorites(ctx.from.id)
	return ctx.reply(fav.text,{parse_mode:'HTML',reply_markup:{inline_keyboard:fav.kb}})
})
bot.on('inline_query', async ({inlineQuery,answerInlineQuery }) => {
	let results = [], replChar = '__'
	const params = /^(gif)?\s*([a-z0-9-_\.]{1,59}\.(near|testnet))\s*(gif)?$/i.exec(inlineQuery.query)
	if (!params) return 
	const wallet = params[2].toLowerCase()
	const offset = inlineQuery.offset.length?+inlineQuery.offset:0
	let data
	try{
		data = JSON.parse(await nfts.get(wallet))
		for (let i=offset;i<data.data.length;i++){
			if (i-offset>=50) break
			if (data.data[i].media){
				if (params[1] || params[4]) results.push({type:'gif',id:offset+i, thumb_url:data.data[i].media, gif_url:data.data[i].media, caption:'<b>'+wallet+'</b>'+(data.data[i].text.length>0 && data.data[i].text.length<960?' - '+data.data[i].text:''), parse_mode:'HTML', reply_markup:{inline_keyboard:[[{text:'View NFT in bot',url:'https://t.me/nearnftbot?start='+wallet.replace(/\./g,replChar)+replChar+(i+1)}]]}})
				else results.push({type:'photo',id:offset+i, thumb_url:data.data[i].media, photo_url:data.data[i].media, caption:'<b>'+wallet+'</b>'+(data.data[i].text.length>0 && data.data[i].text.length<960?' - '+data.data[i].text:''), parse_mode:'HTML', reply_markup:{inline_keyboard:[[{text:'View NFT in bot',url:'https://t.me/nearnftbot?start='+wallet.replace(/\./g,replChar)+replChar+(i+1)}]]}})
			}	
		}		
		
	}catch(err){}
	return answerInlineQuery(results, {cache_time:60, next_offset:''+(offset+50), is_personal:false, switch_pm_text:(data && data.data && data.data.length?'':'Load NFTs of ')+wallet, switch_pm_parameter:wallet.length?wallet.replace(/\./g,replChar):'up'})
})
bot.on('text', ctx => ctx.reply('Wrong NEAR account name',{reply_markup:{keyboard:mainKB, resize_keyboard:true}}))
bot.on('message', ctx => ctx.reply('Unrecognized command',{reply_markup:{keyboard:mainKB, resize_keyboard:true}}))
bot.catch(err => console.error(err))
bot.launch({polling:{timeout:60}})
