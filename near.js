const fetch 	= require('node-fetch')
const nearApi = require("near-api-js")

getNFTs = async function (accountId){
	try{
		const res = await fetch('https://helper.'+(accountId.substr(-5)=='.near'?'mainnet':'testnet')+'.near.org/account/'+accountId+'/likelyNFTs',{timeout:30000})
		if (res.status<199 || res.status>299) {return {error:res.statusText+' ('+res.status+')'}}
		const text = await res.text()
		try{
			return JSON.parse(text)
		} catch(err){return {error:text}}
	}catch(err){return {error:err}}
}
getParas = async function (accountId,skip=0,limit=30){
	try{
		const res = await fetch('https://mainnet-api.paras.id/tokens?excludeTotalBurn=true&ownerId='+accountId+'&__skip='+skip+'&__limit='+limit,{timeout:30000})
		if (res.status<199 || res.status>299) {return {error:res.statusText+' ('+res.status+')'}}
		const text = await res.text()
		try{
			return JSON.parse(text)
		} catch(err){return {error:text}}
	}catch(err){return {error:err}}
}
getMintbase = async function (url){
	try{
		const res = await fetch(url,{timeout:10000}) 
		if (res.status<199 || res.status>299) {return {error:res.statusText+' ('+res.status+')'}}
		const text = await res.text()
		try{
			return JSON.parse(text)
		} catch(err){return {error:text}}
	}catch(err){return {error:err}}
}

parasCard = function (data){
	const result = {type:'paras.id', text:'<code>PARAS.ID</code>\n'}
	if (!data) return {text:result.text+'\nNo data'}
	if (data.metadata && data.metadata.image && data.metadata.image!='') result.text += '<a href="https://ipfs.fleek.co/ipfs/'+data.metadata.image.substr(7)+'">NFT</a> '
//	if (data.metadata && data.metadata.image && data.metadata.image!='') result.text += '<a href="https://cdn.paras.id/tr:w-600/'+data.metadata.image.substr(7)+'">NFT</a> '
	if (data.creatorId && data.creatorId!='') result.text += '<i>created by '+data.creatorId+(data.createdAt?' at '+(new Date(data.createdAt).toLocaleString().split(' ')[0]):'')+'</i>'
	if (data.tokenId && data.tokenId!='') result.text += ' (<a href="https://paras.id/token/'+data.tokenId+'">web</a>)'
	result.text += '\n\n'
	if (data.metadata){
		if (data.metadata.name && data.metadata.name.trim()!='') 				result.text += '<i>name: </i><b>'+data.metadata.name.trim().replace(/[\<\>]/g,'')+'</b>\n'
		if (data.metadata.collection && data.metadata.collection.trim()!='') 	result.text += '<i>collection: </i>'+data.metadata.collection.trim().replace(/[\<\>]/g,'')+'\n'
		if (data.metadata.royalty) 												result.text += '<i>royalty: </i>'+data.metadata.royalty+'\n'
		if (data.metadata.description && data.metadata.description.trim()!='') 	result.text += '<i>'+data.metadata.description.trim().replace(/[\<\>]/g,'')+'</i>\n'
	}
	if (data.metadata.image && data.metadata.image!='') result.media = 'https://ipfs.fleek.co/ipfs/'+data.metadata.image.substr(7)
	return result
}
mintbaseCard = function (data,id){
	const result = {type:'mintbase', text:'<code>MINTBASE</code>\n\n'}
	if (!data) return {text:result.text+'No data'}
	if (id != undefined && id!='') 					result.text += '<i>id: </i>'+id+''
	if (data.media && data.media!='') 				result.text += ', <a href="'+data.media+'">image</a> '
	if (data.animation_url && data.animation_url!='') result.text += ', <a href="'+data.animation_url+'">animation</a> '
	if (data.youtube_url && data.youtube_url!='') 	result.text += ', <a href="'+data.youtube_url+'">youtube</a> '
	if (data.document && data.document!='') 		result.text += ', <a href="'+data.document+'">document</a> '
	if (data.title && data.title!='') 				result.text += '<i>\nname: </i><b>'+data.title.trim().replace(/[\<\>]/g,'')+'</b>\n'
	if (data.category && data.category.trim()!='') 	result.text += '<i>category: </i>'+data.category.trim().replace(/[\<\>]/g,'')+'\n'
	if (data.description && data.description.trim()!='') result.text += '<i>'+data.description.trim().replace(/[\<\>]/g,'')+'</i>\n'
	if (data.store && data.store!='') 				result.text += '<i>store: </i>https://www.mintbase.io/store/'+data.store+'\n'
	result.media = data.media || data.animation_url || data.youtube_url
	return result
}
pluminiteCard = function (data){
	const result = {type:'pluminite', text:'<code>PLUMINITE</code>\n'}
	if (!data) return {text:result.text+'\nNo data'}
	if (data.metadata){
		if (data.metadata.media && data.metadata.media!=''){
			result.token = data.token_id
			result.media = 'https://storage.pluminite.com/ipfs/'+data.metadata.media
			result.text += '<a href="'+result.media+'">NFT</a> '
		}
		if (data.metadata.issued_at && data.metadata.issued_at!='') result.text += '<i>issued at '+(new Date(+data.metadata.issued_at).toLocaleString().split(' ')[0])+'</i>'
		result.text += '\n\n'	
		if (data.metadata.title && data.metadata.title.trim()!='') result.text += '<i>name: </i><b>'+data.metadata.title.trim().replace(/[\<\>]/g,'')+'</b>\n'
		if (data.metadata.description && data.metadata.description.trim()!='') result.text += '<i>'+data.metadata.description.trim().replace(/[\<\>]/g,'')+'</i>\n'
	}
	if (data.token_id && data.token_id!='') result.text += '<i>web: </i><a href="https://pluminite.com/#/gem-original/'+data.token_id+'">'+data.token_id+'</a>\n'
	
	return result
}
hiphopCard = function (data){
	const result = {type:'hiphophead', text:'<code>HIPHOPHEAD</code>\n\n'}
	if (!data) return {text:result.text+'No data'}
	result.token = data.token_id
	if (data.metadata){
		if (data.metadata.title && data.metadata.title!='') result.text += '<i>name: </i><b>'+data.metadata.title.trim().replace(/[\<\>]/g,'')+'</b>\n'
		if (data.metadata.description && data.metadata.description!='') result.text += '<i>'+data.metadata.description.trim().replace(/[\<\>]/g,'')+'</i>\n'
		if (data.metadata.media && data.metadata.media!=''){
			result.media = 'https://sweet-paper-723d.near.workers.dev/?uhhm-heads-cid='+data.metadata.media.replace(/\/low-res.+$/,'')
			result.text += '<a href="'+result.media+'">Head</a> '
		}
	}
	if (data.metadata && data.metadata.issued_at && data.metadata.issued_at!='') result.text += '<i>issued at '+(new Date(+data.metadata.issued_at).toLocaleString().split(' ')[0])+'</i>\n'
	return result
}
mailgunCard = function (data){
	const result = {type:'mailgun', text:'<code>MAILGUN</code>\n\n'}
	if (!data) return {text:result.text+'No data'}
	if (data.metadata){
		if (data.metadata.title && data.metadata.title!='') result.text += '<b>'+data.metadata.title.trim().replace(/[\<\>]/g,'')+'</b>\n'
		if (data.metadata.media && data.metadata.media!=''){
			result.token = data.token_id
			result.media = data.metadata.media
			result.text += '<a href="'+result.media+'">&#8203;</a>\n'
		}
	}
	return result
}
watchCard = function (data){
	const result = {type:'near.watch', text:'<a href="https://near.watch"><b>NEAR.WATCH</b></a>\n\n'}
	if (!data) return {text:result.text+'No data'}
	if (data.metadata && data.metadata.media && data.metadata.media!=''){
		result.token = data.token_id
		result.media = data.metadata.media
		result.text += result.media+'\n'
	}
	return result
}
etcCard = function (data,contractId){
	const result = {type:contractId, text:'<code>'+contractId.toUpperCase()+'</code>\n\n'}
	if (!data) return {text:result.text+'No data'}
	if (data.metadata){
		if (data.metadata.title && data.metadata.title.trim()!='') result.text += '<i>name: </i><b>'+data.metadata.title.trim().replace(/[\<\>]/g,'')+'</b>\n'
		if (data.metadata.description && data.metadata.description.trim()!='') result.text += '<i>'+data.metadata.description.trim().replace(/[\<\>]/g,'')+'</i>\n'
		if (data.metadata.media && data.metadata.media!=''){
			result.token = data.token_id
			result.media = data.metadata.media
			result.text += result.media+'\n'
		}
	}
	if (data.metadata && data.metadata.issued_at && data.metadata.issued_at!='') result.text += '<i>issued at '+(new Date(+data.metadata.issued_at).toLocaleString().split(' ')[0])+'</i>\n'
	result.data = data
	return result
}

viewNFT = async (contractId) => {
	try{
		const network = contractId.substr(-5) == '.near'?'mainnet':'testnet'
		const provider = new nearApi.providers.JsonRpcProvider('https://rpc.'+network+'.near.org')
        const account = new nearApi.Account({provider: provider})
        return await account.viewFunction(contractId,'nft_metadata',{})
	}catch(err){
		return {error:err.type || err}
	}
}
viewAccountNFT = async (contractId,accountId) => {
	try{
		const result = []
		// PARAS.ID
		if (contractId == 'paras.id'){ 
			let offset = 0
			while (1){
				const paras = await getParas(accountId,offset,30)
				if (paras.error || !paras.status || !paras.data || !paras.data.results || !paras.data.results.length) return result
				for (const data of paras.data.results) 
					if (data && !data.error) result.push({contract:contractId,...parasCard(data)})
				if (paras.data.results.length<30) break
				offset += 30
			}
			return result
		}
		const network = accountId.substr(-5) == '.near'?'mainnet':'testnet'
		const provider = new nearApi.providers.JsonRpcProvider('https://rpc.'+network+'.near.org')
        const account = new nearApi.Account({provider:provider})
		// PLUMINITE, MAILGUN, NEAR.WATCH, HIPHOPHEAD
		if (contractId.indexOf('mintbase')<0){
			const list = await account.viewFunction(contractId,'nft_tokens_for_owner',{account_id:accountId, from_index:'0', limit:contractId.indexOf('collab-land.near')>0?'100':100})  
			if (list && list.error) return list
			for (const data of list){
				switch (contractId){
					case 'pluminite.near':
						result.push({contract:contractId,...pluminiteCard(data)})
						break
					case 'mailgun.near':
						result.push({contract:contractId,...mailgunCard(data)})
						break
					case 'nft.widget.near':
						result.push({contract:contractId,...watchCard(data)})
						break
					case 'uhhmnft.near':
						result.push({contract:contractId,...hiphopCard(data)})
						break
					default:	
						result.push({contract:contractId,...etcCard(data,contractId)})
				} 
			}
			return result
		}
		// MINTBASE
		const list = await account.viewFunction(contractId,'nft_tokens_for_owner_set',{account_id:accountId, from_index:'0', limit:100})
		if (list.error) return list
		const urlData = {}, urlPtr = {}
		for (const id of list){
			const url = await account.viewFunction(contractId,'nft_token_uri',{token_id:''+id})
			if (url && url.error) continue
			const data = urlData[url]?urlData[url]:await getMintbase(url)
			if (data && !data.error){
				urlData[url] = data
				if (urlPtr[url] == undefined){
					urlPtr[url] = result.length
					result.push({contract:contractId,...mintbaseCard(urlData[url],id),id:id})
				} else {
					const nid = result[urlPtr[url]].id+','+id
					result[urlPtr[url]] = {contract:contractId,...mintbaseCard(urlData[url],nid),id:nid}
				}	
			}	
		}	
		return result
	}catch(err){
		console.log(err)
		return {error:err.type || err}
	}
}
keysList = async (accountId) => {
	try{
		const network = accountId.substr(-5) == '.near'?'mainnet':'testnet'
		const config  = {networkId:network, nodeUrl:'https://rpc.'+network+'.near.org'}
		const keyStore = new nearApi.keyStores.InMemoryKeyStore()
		const near = await nearApi.connect({deps:{keyStore},...config})
		const account = await near.account(accountId)
		return await account.getAccessKeys()
	}catch(err){
		return {error:err.type || err}
	}
}
loginURL = (contractId) => {
	const network = contractId.substr(-5) == '.near'?'mainnet':'testnet'
	const keypair = nearApi.utils.KeyPair.fromRandom('ed25519')	
	const res = {public_key:keypair.publicKey.toString(), private_key: keypair.secretKey}	
	res.url = 'https://wallet.'+network+'.near.org/login?public_key='+res.public_key 
	return res
}
transferNFT = async (keys, contractId, tokenId, senderId, receiverId) => {
	console.log(keys, contractId, tokenId, senderId, receiverId)
    try {
		const network = contractId.substr(-5) == '.near'?'mainnet':'testnet'
		const config = {networkId:network, nodeUrl:'https://rpc.'+network+'.near.org'}
		const keyPair = nearApi.utils.KeyPair.fromString(keys.private_key)
		const keyStore = new nearApi.keyStores.InMemoryKeyStore()
		keyStore.setKey(network,senderId,keyPair)
		const near = await nearApi.connect({deps:{keyStore},...config})
		const account = await near.account(senderId)
		const tx = await account.functionCall({contractId:contractId, methodName:'nft_transfer', args:{token_id:tokenId, receiver_id:receiverId, enforce_owner_id:senderId, memo:'', copies:1},gas:'100000000000000',attachedDeposit:'1'}) 
        return tx.status.Failure?{error:tx.status.Failure}:tx.transaction.hash
	}catch(err){
		return {error:err.type || err}
	}
}

module.exports = {getParas,getNFTs,viewNFT,viewAccountNFT,loginURL,keysList,transferNFT}
