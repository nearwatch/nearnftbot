use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, ext_contract, Balance, require, PublicKey, Gas, near_bindgen, AccountId, PanicOnDefault, Promise, PromiseResult};
use near_sdk::json_types::{U128};
use near_sdk::utils::{assert_self};
use near_sdk::serde::{Serialize, Deserialize};

const PRICE_STEP: u128 = 10_000_000_000_000_000_000_000;

pub fn get_wallet(account: AccountId) -> &'static str {
    let s1 = account.to_string();
    let s2: String = s1.chars().skip(s1.len()-7).take(7).collect();
    match s2 == "testnet" {true => "widget.testnet", false => "widget.near"}
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Contract {
    pub owner_id: AccountId,
	  pub next_id: Option<AccountId>,
	  pub price: Balance,
}
#[ext_contract(ext_self)]
pub trait ExtContract {
    fn on_payment(&mut self, owner_id:AccountId, buyer_id:AccountId, price:Balance) -> bool;
    fn on_access_key_added(&mut self, owner_id:AccountId) -> bool;
}
fn is_promise_success() -> bool {
    assert_eq!(env::promise_results_count(),1,"Contract expected a result on the callback");
    match env::promise_result(0) {PromiseResult::Successful(_) => true, _ => false}
}
#[near_bindgen]
impl Contract {
    #[init(ignore_state)]
    pub fn lock(owner_id: AccountId, next_id:Option<AccountId>, price:U128) -> Self {
        assert_self();
        require!(env::is_valid_account_id(owner_id.as_bytes()),"Owner account is invalid");
        Self {owner_id:owner_id, next_id:match next_id {None => None, Some(next_id) => Some(next_id)}, price:price.into()}
    }
	  #[payable]
    pub fn unlock(&mut self, public_key:PublicKey) {
        assert_eq!(env::predecessor_account_id(), self.owner_id, "Only for owners");
		    require!(PRICE_STEP <= env::attached_deposit(),"Not enough deposit for unlock the account");
		    self.next_id = Some(env::predecessor_account_id());
        Promise::new(env::current_account_id()).add_full_access_key(public_key.into()).then(ext_self::on_access_key_added(env::predecessor_account_id(), env::current_account_id(), 0, Gas(25_000_000_000_000)));
    }
	  #[payable]
    pub fn buy(&mut self, next_id:Option<AccountId>) {
		    let amount = env::attached_deposit();
		    require!(self.price <= amount,"Not enough deposit for buying the account");
		    require!(self.next_id.is_none() || self.owner_id == env::predecessor_account_id() || self.next_id == Some(env::predecessor_account_id()),"You cannot buy the account");
		    self.next_id = match next_id {None => None, Some(next_id) => Some(next_id)};
		    Promise::new(self.owner_id.clone()).transfer(amount - amount/200).then(ext_self::on_payment(self.owner_id.clone(), env::predecessor_account_id(), amount, env::current_account_id(), 0, Gas(20_000_000_000_000)));
    }
    pub fn on_payment(&mut self, owner_id:AccountId, buyer_id:AccountId, price:Balance) -> bool {
        assert_self();
		    self.owner_id = buyer_id.clone();
		    self.price = (price/PRICE_STEP+1)*PRICE_STEP;
		    let wallet = get_wallet(owner_id.clone());
		    let mut amount = price/200;
        let transfer_succeeded = is_promise_success();
        if transfer_succeeded {
            env::log_str(&format!("Transaction to @{} success. {} yNEAR sent. New owner is {}", owner_id, price, buyer_id));
        } else {
			      amount = price;
			      env::log_str(&format!("Transaction to @{} failed. Deposit redirected to @{}", owner_id, wallet));
        }
		    if price>0 {
			      Promise::new(AccountId::new_unchecked(wallet.to_string())).transfer(amount);
		    }
		    transfer_succeeded
    }
    pub fn on_access_key_added(&mut self, owner_id: AccountId) -> bool {
        assert_self();
        let access_key_created = is_promise_success();
        if access_key_created {
			      let wallet = get_wallet(owner_id.clone());
			      Promise::new(AccountId::new_unchecked(wallet.to_string())).transfer(PRICE_STEP);
		    } else {
            env::log_str(&format!("Failed to generate key for @{}", owner_id));
        }
        access_key_created
    }
    pub fn get_info(&self) -> Self {
        Self {owner_id:self.owner_id.clone(), next_id:self.next_id.clone(), price:self.price}
    }
}
